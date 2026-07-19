# SPDX-FileCopyrightText: 2026 Nikita Konton
# SPDX-License-Identifier: GPL-3.0-or-later

cmake_minimum_required(VERSION 3.22)

project(
    driftile-wheel-control
    VERSION 0.1.0
    LANGUAGES CXX
)

set(CMAKE_AUTOMOC ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(DRIFTILE_VERSION "development" CACHE STRING "Driftile version embedded in plugin metadata")
if(NOT DRIFTILE_VERSION MATCHES "^[0-9A-Za-z][0-9A-Za-z.+_-]*$")
    message(FATAL_ERROR "DRIFTILE_VERSION must contain only version-safe characters")
endif()

configure_file(
    metadata.json.in
    "${CMAKE_CURRENT_BINARY_DIR}/driftile-wheel-control-metadata.json"
    @ONLY
)

find_package(ECM 6.0 REQUIRED NO_MODULE)
list(APPEND CMAKE_MODULE_PATH "${ECM_MODULE_PATH}")

include(KDEInstallDirs)
include(KDECMakeSettings)
include(KDECompilerSettings NO_POLICY_SCOPE)

find_package(Qt6 6.7 REQUIRED COMPONENTS Core DBus Gui Quick Widgets)
find_package(KF6CoreAddons 6.0 REQUIRED)
find_package(KWin 6.7 REQUIRED)

kcoreaddons_add_plugin(
    driftile_wheel_control
    INSTALL_NAMESPACE "kwin/effects/plugins"
    SOURCES
        src/main.cpp
        src/wheelcontroleffect.cpp
        src/wheelcontroleffect.h
)

set_property(
    SOURCE src/main.cpp
    PROPERTY OBJECT_DEPENDS "${CMAKE_CURRENT_BINARY_DIR}/driftile-wheel-control-metadata.json"
)
target_include_directories(driftile_wheel_control PRIVATE "${CMAKE_CURRENT_BINARY_DIR}")
set_property(
    TARGET driftile_wheel_control
    APPEND PROPERTY AUTOMOC_MACRO_NAMES KWIN_EFFECT_FACTORY
)

target_link_libraries(driftile_wheel_control PRIVATE
    KWin::kwin
    Qt6::Core
    Qt6::DBus
    Qt6::Gui
)

target_compile_options(driftile_wheel_control PRIVATE
    -Wall
    -Wextra
    -Wpedantic
    -Werror
)
