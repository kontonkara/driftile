# SPDX-FileCopyrightText: 2026 Nikita Konton
# SPDX-License-Identifier: GPL-3.0-or-later

cmake_minimum_required(VERSION 3.22)

project(
    driftile-shortcut-editor
    VERSION 0.1.0
    LANGUAGES CXX
)

set(DRIFTILE_VERSION "development" CACHE STRING "Driftile version displayed by the shortcut editor")
if(NOT DRIFTILE_VERSION MATCHES "^[0-9A-Za-z][0-9A-Za-z.+_-]*$")
    message(FATAL_ERROR "DRIFTILE_VERSION must contain only version-safe characters")
endif()

string(REPLACE "\\" "\\\\" DRIFTILE_VERSION_ESCAPED "${DRIFTILE_VERSION}")
string(REPLACE "\"" "\\\"" DRIFTILE_VERSION_ESCAPED "${DRIFTILE_VERSION_ESCAPED}")
string(REPLACE ";" "\\;" DRIFTILE_VERSION_ESCAPED "${DRIFTILE_VERSION_ESCAPED}")

set(CMAKE_AUTOMOC ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.7 REQUIRED COMPONENTS Core DBus Widgets)
find_package(KF6GlobalAccel REQUIRED)
find_package(KF6XmlGui REQUIRED)

include(GNUInstallDirs)

add_executable(driftile-shortcut-editor
    src/main.cpp
    src/shortcutbackend.cpp
    src/shortcutbackend.h
    src/shortcuteditorwindow.cpp
    src/shortcuteditorwindow.h
    src/shortcuttablemodel.cpp
    src/shortcuttablemodel.h
    src/shortcuttypes.cpp
    src/shortcuttypes.h
)

target_link_libraries(driftile-shortcut-editor PRIVATE
    Qt6::Core
    Qt6::DBus
    Qt6::Widgets
    KF6::GlobalAccel
    KF6::XmlGui
)

target_compile_options(driftile-shortcut-editor PRIVATE
    -Wall
    -Wextra
    -Wpedantic
    -Werror
)

target_compile_definitions(driftile-shortcut-editor PRIVATE
    "DRIFTILE_VERSION=\"${DRIFTILE_VERSION_ESCAPED}\""
)

install(TARGETS driftile-shortcut-editor RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR})
install(
    FILES data/io.github.kontonkara.driftile.shortcuts.desktop
    DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/applications
)
install(
    FILES data/io.github.kontonkara.driftile.shortcuts.metainfo.xml
    DESTINATION ${CMAKE_INSTALL_DATAROOTDIR}/metainfo
)
