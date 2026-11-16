#!/bin/bash
# Build the Hover! web runtime: lifted original code + win32hle + web host.
set -e
export EMSDK=/tmp/emsdk
export PATH=$EMSDK/upstream/emscripten:$EMSDK/upstream/bin:$PATH
RECOMP=/home/z/my-project/pcrecomp/runtime
GEN=/tmp/hover-lift/src/recomp/gen
WEB=/tmp/hover-web

FLAGS="-O2 -g2 -m32 -sWASM=1 -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=4GB \
 -sGLOBAL_BASE=16777216 -sINITIAL_MEMORY=64MB -sASYNCIFY -sSTACK_SIZE=5MB \
 -sUSE_SDL=2 -sUSE_SDL_TTF=2 -sNO_DISABLE_EXCEPTION_CATCHING=1 \
 -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,HEAPU8,HEAPU32,FS,stringToUTF8,UTF8ToString,addFunction,removeFunction \
 -sEXPORTED_FUNCTIONS=_malloc,_hw_boot,_hw_dashres,_hw_run,_hw_frame,_hw_key,_hw_mouse,_hw_screen_ptr,_hw_screen_dims,_hw_presented,_hw_palette,_hw_alive,_hw_char\
 -DRECOMP_FLAT_MEMORY -DRECOMP_LOCAL_REGS -DRECOMP_RETADDR=0 -DHLE_FLAT -DHLE_FIXED_END=0x1000000 \
 -D_CRT_SECURE_NO_WARNINGS -I$RECOMP/recomp32 -I$RECOMP/win32hle -I$WEB \
 -I/home/z/my-project/pcrecomp/runtime/recomp32"

# library files (stock + web overrides)
LIBS="$RECOMP/win32hle/host_lite.c \
 $RECOMP/win32hle/guest_mem.c \
 $RECOMP/win32hle/module.c \
 $RECOMP/win32hle/pe_loader.c \
 $RECOMP/win32hle/kernel32.c \
 $RECOMP/win32hle/kernel32_crt.c \
 $RECOMP/win32hle/kernel32_ext.c \
 $RECOMP/win32hle/storage.c \
 $RECOMP/win32hle/hle_path.c \
 $RECOMP/win32hle/gdidc.c \
 $RECOMP/win32hle/gdi32.c \
 $RECOMP/win32hle/user32.c \
 $RECOMP/win32hle/advapi32.c \
 $RECOMP/win32hle/lz32.c \
 $RECOMP/win32hle/ole32.c \
 $WEB/winmm_web.c \
 $WEB/web_hooks.c \
 $WEB/web_host.c"

FILES=$(ls $GEN/recomp_[0-9]*.c $GEN/recomp_dispatch.c)
emcc $FLAGS $LIBS $FILES \
  --preload-file /home/z/my-project/hover-data/HOVER@/c/HOVER \
  --preload-file /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf@/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf \
  --preload-file /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf@/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf \
  -o /home/z/my-project/download/hover/hover.js 2>&1 | tail -25
echo "BUILD DONE: $?"
