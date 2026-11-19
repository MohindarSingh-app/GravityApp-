cmake_minimum_required(VERSION 3.13)

set(CMAKE_OBJECT_PATH_MAX 220 CACHE STRING "Maximum native object path length" FORCE)

project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)