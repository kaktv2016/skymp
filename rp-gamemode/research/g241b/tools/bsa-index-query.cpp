// Bounded read-only BSA index query. Loads archive metadata and checks named
// members only; never extracts or writes archive contents.
#include <bsa/tes4.hpp>

#include <filesystem>
#include <iostream>
#include <string>
#include <string_view>

static std::string json_escape(std::string_view value)
{
  std::string out;
  out.reserve(value.size() + 8);
  for (unsigned char c : value) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b"; break;
      case '\f': out += "\\f"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default: if (c < 0x20) return {}; else out.push_back(static_cast<char>(c));
    }
  }
  return out;
}

static bool safe_relative(std::string_view p)
{
  if (p.empty() || p.size() > 512 || p.find(':') != p.npos || p.front() == '/' || p.front() == '\\') return false;
  std::string segment;
  for (char c : p) {
    if (c == '/' || c == '\\') {
      if (segment.empty() || segment == "." || segment == "..") return false;
      segment.clear();
    } else if (static_cast<unsigned char>(c) < 0x20) return false;
    else segment.push_back(c);
  }
  return !segment.empty() && segment != "." && segment != "..";
}

int main(int argc, char **argv)
{
  if (argc < 3 || argc > 514) {
    std::cerr << "Usage: bsa-index-query <Skyrim-base.bsa> <relative-resource>...\n";
    return 64;
  }
  try {
    const std::filesystem::path archivePath = std::filesystem::canonical(argv[1]);
    const auto filename = archivePath.filename().string();
    if (filename.rfind("Skyrim - ", 0) != 0 || archivePath.extension() != ".bsa") {
      std::cerr << "Only base-game Skyrim - *.bsa archives are accepted\n";
      return 65;
    }
    bsa::tes4::archive archive;
    const auto version = archive.read(archivePath);
    if (version != bsa::tes4::version::sse || !archive.directory_strings() || !archive.file_strings()) {
      std::cerr << "Unsupported archive version or absent directory/file names\n";
      return 66;
    }
    std::cout << "{\"archive\":\"" << json_escape(filename) << "\",\"version\":105,\"queries\":[";
    for (int i = 2; i < argc; ++i) {
      if (!safe_relative(argv[i])) {
        std::cerr << "Unsafe resource query path\n";
        return 67;
      }
      std::string input(argv[i]);
      for (char &c : input) if (c == '/') c = '\\';
      const auto split = input.find_last_of('\\');
      const std::string directory = split == std::string::npos ? std::string{} : input.substr(0, split);
      const std::string fileName = split == std::string::npos ? input : input.substr(split + 1);
      auto dir = archive.find(bsa::tes4::directory::key(directory));
      bool found = false;
      std::size_t storedSize = 0;
      std::size_t decodedSize = 0;
      if (dir != archive.end()) {
        auto file = dir->second.find(bsa::tes4::file::key(fileName));
        if (file != dir->second.end()) {
          found = true;
          storedSize = file->second.size();
          decodedSize = file->second.compressed() ? file->second.decompressed_size() : storedSize;
        }
      }
      if (i != 2) std::cout << ',';
      std::cout << "{\"path\":\"" << json_escape(argv[i]) << "\",\"found\":" << (found ? "true" : "false")
                << ",\"storedSize\":" << storedSize << ",\"decodedSize\":" << decodedSize << '}';
    }
    std::cout << "]}\n";
    return 0;
  } catch (const std::exception &e) {
    std::cerr << "BSA_INDEX_ERROR: " << e.what() << '\n';
    return 70;
  }
}
