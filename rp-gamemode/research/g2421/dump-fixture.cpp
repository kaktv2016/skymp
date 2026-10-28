#include "../../../skymp5-server/cpp/addon/IsolatedCrashDump.h"
// Dedicated diagnostic child only; never linked into a game or server.
int main()
{
  SetErrorMode(SEM_NOGPFAULTERRORBOX | SEM_FAILCRITICALERRORS);
  IsolatedCrashDump::Install();
  volatile int* invalid = nullptr;
  *invalid = 1;
  return 0;
}
