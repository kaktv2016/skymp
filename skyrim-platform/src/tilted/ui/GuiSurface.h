#pragma once
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <vector>

// CPU-only CEF backing store. Caller serializes Push/Take. GPU work never holds
// this store's lock. Dirty updates preserve untouched pixels across paints.
struct GuiSurface {
  struct Rect { int x, y, width, height; };
  int width = 0, height = 0;
  std::vector<uint8_t> pixels;
  Rect dirty{};
  bool pending = false;
  void Push(const void* buffer, int w, int h, const std::vector<Rect>& rects) {
    if (!buffer || w <= 0 || h <= 0 || w > 8192 || h > 8192 ||
        uint64_t(w) * h > 33554432) return;
    const bool resized = w != width || h != height;
    if (resized) { width = w; height = h; pixels.resize(size_t(w) * h * 4); pending = false; }
    const auto copy = [&](Rect r) {
      const int left = (std::max)(0, r.x), top = (std::max)(0, r.y);
      const int right = int((std::min)(int64_t(w), int64_t(r.x) + r.width));
      const int bottom = int((std::min)(int64_t(h), int64_t(r.y) + r.height));
      if (left >= right || top >= bottom) return;
      for (int y = top; y < bottom; ++y) {
        const size_t offset = (size_t(y) * w + left) * 4;
        std::memcpy(pixels.data() + offset, static_cast<const uint8_t*>(buffer) + offset, size_t(right - left) * 4);
      }
      if (!pending) dirty = {left, top, right-left, bottom-top};
      else {
        const int x = (std::min)(dirty.x, left), y = (std::min)(dirty.y, top);
        dirty = {x, y, (std::max)(dirty.x+dirty.width,right)-x, (std::max)(dirty.y+dirty.height,bottom)-y};
      }
      pending = true;
    };
    if (resized || rects.empty()) copy({0, 0, w, h});
    else for (const auto& rect : rects) copy(rect);
  }
  bool Take(int w, int h, bool forceFull, Rect& rect, std::vector<uint8_t>& output) {
    if (w != width || h != height || pixels.empty() || (!pending && !forceFull)) return false;
    rect = forceFull ? Rect{0,0,w,h} : dirty;
    output.resize(size_t(rect.width) * rect.height * 4);
    for (int y = 0; y < rect.height; ++y)
      std::memcpy(output.data()+size_t(y)*rect.width*4, pixels.data()+(size_t(y+rect.y)*w+rect.x)*4, size_t(rect.width)*4);
    pending = false;
    return true;
  }
};
