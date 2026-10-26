// Read and decompress only explicitly named, bounded members from a Skyrim SE BSA.
#include <bsa/tes4.hpp>
#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <string>
#include <vector>
#include <windows.h>

int main(int argc, char **argv) {
  if (argc != 4) { std::cerr << "Usage: bsa-member-read <Skyrim-base.bsa> <relative-member> <output-file>\n"; return 64; }
  try {
    std::filesystem::path archivePath = std::filesystem::canonical(argv[1]);
    std::string memberPath(argv[2]);
    if (archivePath.filename().string().rfind("Skyrim - ", 0) != 0 || archivePath.extension() != ".bsa" || memberPath.empty() || memberPath.size() > 512 || memberPath.find("..") != std::string::npos || memberPath.find(':') != std::string::npos) return 65;
    for (char &c : memberPath) if (c == '/') c = '\\';
    auto split = memberPath.find_last_of('\\');
    auto dirName = split == std::string::npos ? std::string{} : memberPath.substr(0, split);
    auto fileName = split == std::string::npos ? memberPath : memberPath.substr(split + 1);
    bsa::tes4::archive archive;
    if (archive.read(archivePath) != bsa::tes4::version::sse || !archive.directory_strings() || !archive.file_strings()) return 66;
    auto dir = archive.find(bsa::tes4::directory::key(dirName));
    if (dir == archive.end()) return 67;
    auto file = dir->second.find(bsa::tes4::file::key(fileName));
    if (file == dir->second.end()) return 68;
    auto &data = file->second;
    if (data.compressed() && data.decompressed_size() > 32 * 1024 * 1024) return 69;
    if (!data.compressed() && data.size() > 32 * 1024 * 1024) return 69;
    if (data.compressed()) data.decompress(bsa::tes4::version::sse);
    if (data.size() > 32 * 1024 * 1024) return 69;
    const auto auditRoot = std::filesystem::canonical(std::filesystem::current_path() / "build" / "rp-audit");
    const auto output = std::filesystem::absolute(argv[3]).lexically_normal();
    const auto parent = std::filesystem::canonical(output.parent_path());
    auto relative = parent.lexically_relative(auditRoot);
    if (relative.empty() || relative.is_absolute() || *relative.begin() == ".." || output.extension() != ".nif") return 69;
    const auto targetStatus = std::filesystem::symlink_status(output);
    if (targetStatus.type() != std::filesystem::file_type::not_found) {
      if (!std::filesystem::is_regular_file(targetStatus) || std::filesystem::hard_link_count(output) != 1) return 70;
      std::ifstream existing(output, std::ios::binary);
      std::vector<char> prior((std::istreambuf_iterator<char>(existing)), std::istreambuf_iterator<char>());
      if (existing.bad() || prior.size() != data.size() || !std::equal(prior.begin(), prior.end(), reinterpret_cast<const char *>(data.data()))) return 70;
      return 0;
    }
    HANDLE handle = CreateFileW(output.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (handle == INVALID_HANDLE_VALUE) return 70;
    const auto *cursor = reinterpret_cast<const char *>(data.data());
    std::size_t remaining = data.size();
    bool ok = true;
    while (remaining) {
      DWORD written = 0;
      const DWORD chunk = static_cast<DWORD>(std::min<std::size_t>(remaining, 1u << 20));
      if (!WriteFile(handle, cursor, chunk, &written, nullptr) || written == 0) { ok = false; break; }
      cursor += written;
      remaining -= written;
    }
    if (!CloseHandle(handle)) ok = false;
    if (!ok) { std::error_code ec; std::filesystem::remove(output, ec); return 70; }
    return 0;
  } catch (const std::exception &e) { std::cerr << "BSA_MEMBER_READ: " << e.what() << '\n'; return 71; }
}
