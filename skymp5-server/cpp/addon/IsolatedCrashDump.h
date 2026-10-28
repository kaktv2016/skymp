#pragma once

// Opt-in diagnostics for the isolated server only. Dumps contain private stack
// memory and must stay outside HTTP assets/Git. No production registry setting.
#ifdef _WIN32
#include <windows.h>
#include <dbghelp.h>
#include <cwchar>
#pragma comment(lib, "dbghelp.lib")
namespace IsolatedCrashDump {
inline wchar_t directory[MAX_PATH]{};
inline LPTOP_LEVEL_EXCEPTION_FILTER previous = nullptr;
inline volatile LONG writing = 0;
inline HANDLE requested = nullptr, completed = nullptr;
inline EXCEPTION_RECORD savedException{};
inline CONTEXT savedContext{};
inline DWORD crashedThread = 0;
inline DWORD WINAPI Worker(void*)
{
  if (WaitForSingleObject(requested, INFINITE) == WAIT_OBJECT_0) {
    wchar_t pattern[MAX_PATH]{};
    swprintf_s(pattern, L"%s\\native-*.dmp", directory);
    WIN32_FIND_DATAW entry{};
    HANDLE search = FindFirstFileW(pattern, &entry);
    unsigned count = 0;
    if (search != INVALID_HANDLE_VALUE) {
      do { ++count; } while (FindNextFileW(search, &entry));
      FindClose(search);
    }
    if (count < 3) {
      wchar_t file[MAX_PATH]{};
      swprintf_s(file, L"%s\\native-%lu-%llu.dmp", directory,
                 GetCurrentProcessId(), GetTickCount64());
      HANDLE output = CreateFileW(file, GENERIC_WRITE, 0, nullptr,
                                  CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr);
      if (output != INVALID_HANDLE_VALUE) {
        EXCEPTION_POINTERS captured{&savedException, &savedContext};
        MINIDUMP_EXCEPTION_INFORMATION info{crashedThread, &captured, FALSE};
        MiniDumpWriteDump(GetCurrentProcess(), GetCurrentProcessId(), output,
                         static_cast<MINIDUMP_TYPE>(MiniDumpNormal | MiniDumpWithThreadInfo),
                         &info, nullptr, nullptr);
        CloseHandle(output);
      }
    }
  }
  SetEvent(completed);
  return 0;
}
inline LONG WINAPI Capture(EXCEPTION_POINTERS* exception)
{
  if (exception && exception->ExceptionRecord && exception->ContextRecord &&
      InterlockedCompareExchange(&writing, 1, 0) == 0) {
    savedException = *exception->ExceptionRecord;
    savedException.ExceptionRecord = nullptr;
    savedContext = *exception->ContextRecord;
    crashedThread = GetCurrentThreadId();
    SetEvent(requested);
    // DbgHelp runs on a pre-created dedicated thread, not the faulting stack.
    // Diagnostics must not hang server shutdown indefinitely.
    WaitForSingleObject(completed, 10000);
  }
  return previous ? previous(exception) : EXCEPTION_CONTINUE_SEARCH;
}
inline void Install()
{
  if (directory[0]) return;
  const auto size = GetEnvironmentVariableW(L"FROSTVEIL_ISOLATED_NATIVE_DUMPS", directory, MAX_PATH);
  if (!size || size >= MAX_PATH - 80 || directory[1] != L':' ||
      GetFileAttributesW(directory) == INVALID_FILE_ATTRIBUTES) {
    directory[0] = 0;
    return;
  }
  requested = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  completed = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  HANDLE thread = requested && completed ? CreateThread(nullptr, 0, Worker, nullptr, 0, nullptr) : nullptr;
  if (!thread) {
    if(requested) CloseHandle(requested);
    if(completed) CloseHandle(completed);
    directory[0] = 0;
    return;
  }
  CloseHandle(thread);
  SetErrorMode(GetErrorMode() | SEM_NOGPFAULTERRORBOX);
  previous = SetUnhandledExceptionFilter(Capture);
}
}
#else
namespace IsolatedCrashDump { inline void Install() {} }
#endif
