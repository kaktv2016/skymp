cmake_minimum_required(VERSION 3.25)
project(GuiSurfaceTest LANGUAGES CXX)
add_executable(surface_test surface.cpp)
target_compile_features(surface_test PRIVATE cxx_std_17)
