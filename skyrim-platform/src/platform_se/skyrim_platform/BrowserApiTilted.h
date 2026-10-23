#pragma once
#include "Settings.h"

#include "NapiHelper.h"

namespace BrowserApiTilted {
Napi::Value SetVisible(const Napi::CallbackInfo& info);
Napi::Value IsVisibleJS(const Napi::CallbackInfo& info);
bool IsVisible();
Napi::Value SetCursorVisible(const Napi::CallbackInfo& info);
Napi::Value IsCursorVisible(const Napi::CallbackInfo& info);
Napi::Value SetFrostveilCursorEnabled(const Napi::CallbackInfo& info);
Napi::Value IsFrostveilCursorEnabled(const Napi::CallbackInfo& info);
Napi::Value SetFocused(const Napi::CallbackInfo& info);
Napi::Value IsFocused(const Napi::CallbackInfo& info);
Napi::Value LoadUrl(const Napi::CallbackInfo& info);
Napi::Value ExecuteJavaScript(const Napi::CallbackInfo& info);
}
