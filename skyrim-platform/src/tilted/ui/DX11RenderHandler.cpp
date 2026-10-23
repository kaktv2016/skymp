#include "DInputHook.hpp"
#include "TextToDraw.h"
#include "GuiPerformance.h"
#include <DX11RenderHandler.h>
#include <DirectXColors.h>
#include <DirectXTK/DDSTextureLoader.h>
#include <DirectXTK/SimpleMath.h>
#include <DirectXTK/WICTextureLoader.h>
#include <OverlayClient.h>
#include <cmrc/cmrc.hpp>
#include <codecvt>
#include <filesystem>
#include <functional>
#include <iostream>
#include <iterator>
#include <spdlog/spdlog.h>
#include <string>

CMRC_DECLARE(skyrim_plugin_resources);

namespace CEFUtils {
DX11RenderHandler::DX11RenderHandler(Renderer* apRenderer) noexcept
  : m_pRenderer(apRenderer)
{
  // So we need to lock this until we have the window dimension as a background
  // CEF thread will attempt to get it before we have it
  m_createLock.lock();
  isCreateLock = true;
}

DX11RenderHandler::~DX11RenderHandler() = default;

void DX11RenderHandler::Render(
  const ObtainTextsToDrawFunction& obtainTextsToDraw)
{
  GuiPerformance::Frame();
  GuiPerformance::Timer renderTimer(GuiPerformance::RenderCpu);
  // We need contexts first
  if (!m_pImmediateContext || !m_pContext) {
    Create();

    if (!m_pImmediateContext || !m_pContext)
      return;
  }

  GetRenderTargetSize();
  const bool newTexture = !m_pTexture;
  if (newTexture) CreateRenderTexture();
  GuiSurface::Rect dirty{};
  bool upload = false;
  {
    std::unique_lock<std::mutex> lock(m_textureLock, std::defer_lock);
    { GuiPerformance::Timer wait(GuiPerformance::TextureWait); lock.lock(); }
    upload = m_surface.Take(m_width, m_height, newTexture, dirty, m_uploadPixels);
  }
  if (upload && m_pTexture) {
    GuiPerformance::Timer timer(GuiPerformance::UploadCpu);
    const D3D11_BOX box{UINT(dirty.x), UINT(dirty.y), 0,
      UINT(dirty.x + dirty.width), UINT(dirty.y + dirty.height), 1};
    m_pImmediateContext->UpdateSubresource(m_pTexture.Get(), 0, &box,
      m_uploadPixels.data(), UINT(dirty.width * 4), 0);
    m_textureReady = true;
  }

  m_pSpriteBatch->Begin(DirectX::SpriteSortMode_Deferred,
                        m_pStates->NonPremultiplied());

  if (Visible()) {
    if (m_pTextureView && m_textureReady) {
      m_pSpriteBatch->Draw(m_pTextureView.Get(),
                           DirectX::SimpleMath::Vector2(0.f, 0.f), nullptr,
                           DirectX::Colors::White, 0.f);
    }
  }

  // obtainTextsToDraw is expected to do nothing if IsVisible is set to false
  // NB: this code is active even if browser backend is nirnlab (for now)
  obtainTextsToDraw([&](const TextToDraw& textToDraw) {
    static_assert(
      std::is_same_v<std::decay_t<decltype(textToDraw.string.c_str()[0])>,
                     wchar_t>);

    std::wstring_convert<std::codecvt_utf8_utf16<wchar_t>> conv;

    auto& font = m_pFonts[conv.to_bytes(textToDraw.fontName)];

    if (!font)
      return;

    auto origin = DirectX::SimpleMath::Vector2(
                    font->MeasureString(textToDraw.string.c_str())) /
      2;

    DirectX::XMVECTORF32 color = { static_cast<float>(textToDraw.color[0]),
                                   static_cast<float>(textToDraw.color[1]),
                                   static_cast<float>(textToDraw.color[2]),
                                   static_cast<float>(textToDraw.color[3]) };

    font->DrawString(m_pSpriteBatch.get(), textToDraw.string.c_str(),
                     DirectX::XMFLOAT2(textToDraw.x, textToDraw.y), color,
                     textToDraw.rotation, origin, textToDraw.size,
                     textToDraw.effects, textToDraw.layerDepth);
  });

  bool& focusFlag = CEFUtils::DInputHook::ChromeFocus();

  if (Visible() && focusFlag && CursorVisible().load()) {
    if (m_pCursorTexture && m_cursorX >= 0 && m_cursorY >= 0) {
      m_pSpriteBatch->Draw(
        m_pCursorTexture.Get(),
        DirectX::SimpleMath::Vector2(m_cursorX - 24, m_cursorY - 25), nullptr,
        DirectX::Colors::White, 0.f, DirectX::SimpleMath::Vector2(0, 0),
        m_width / 1920.f);
    }
  }

  m_pSpriteBatch->End();
}

void DX11RenderHandler::Reset()
{
  Create();
}

void DX11RenderHandler::Create()
{
  const auto hr = m_pRenderer->GetSwapChain()->GetDevice(
    IID_ID3D11Device,
    reinterpret_cast<void**>(m_pDevice.ReleaseAndGetAddressOf()));

  if (FAILED(hr))
    return;

  m_pDevice->GetImmediateContext(m_pImmediateContext.ReleaseAndGetAddressOf());

  if (!m_pImmediateContext)
    return;

  GetRenderTargetSize();

  if (FAILED(m_pDevice->CreateDeferredContext(
        0, m_pContext.ReleaseAndGetAddressOf())))
    return;

  m_pSpriteBatch =
    std::make_unique<DirectX::SpriteBatch>(m_pImmediateContext.Get());

  m_pStates = std::make_unique<DirectX::CommonStates>(m_pDevice.Get());

  if (FAILED(DirectX::CreateWICTextureFromFile(
        m_pDevice.Get(), m_pParent->GetCursorPathPNG().c_str(), nullptr,
        m_pCursorTexture.ReleaseAndGetAddressOf()))) {
    DirectX::CreateDDSTextureFromFile(
      m_pDevice.Get(), m_pParent->GetCursorPathDDS().c_str(), nullptr,
      m_pCursorTexture.ReleaseAndGetAddressOf());
  }

  cmrc::file file;
  try {
    file = cmrc::skyrim_plugin_resources::get_filesystem().open(
      "assets/cursor.png");
  } catch (std::exception& e) {
    auto dir =
      cmrc::skyrim_plugin_resources::get_filesystem().iterate_directory("");
    std::stringstream ss;
    ss << e.what() << std::endl << std::endl;
    ss << "Root directory contents is: " << std::endl;
    for (auto entry : dir)
      ss << entry.filename() << std::endl;
    throw std::runtime_error(ss.str());
  }

  DirectX::CreateWICTextureFromMemory(
    m_pDevice.Get(), reinterpret_cast<const uint8_t*>(file.begin()),
    file.size(), nullptr, m_pCursorTexture.ReleaseAndGetAddressOf());

  std::unique_lock<std::mutex> _(m_textureLock);

  if (!m_pTexture)
    CreateRenderTexture();

  for (const auto& entry :
       std::filesystem::directory_iterator("Data/Platform/Fonts/")) {
    std::filesystem::path path = entry.path();

    if (path.extension().string() != ".spritefont")
      continue;

    spdlog::info("Font has been added - " + entry.path().stem().string());

    std::wstring_convert<std::codecvt_utf8_utf16<wchar_t>> converter;

    auto widestrFontPath =
      converter.from_bytes(static_cast<std::string>(path.string()));

    const wchar_t* fontPath = widestrFontPath.c_str();

    m_pFonts[entry.path().stem().string()] =
      std::make_unique<DirectX::SpriteFont>(m_pDevice.Get(), fontPath);
  }
}

void DX11RenderHandler::GetViewRect(CefRefPtr<CefBrowser> browser,
                                    CefRect& rect)
{
  std::scoped_lock _(m_createLock);

  rect = CefRect(0, 0, m_width, m_height);
}

void DX11RenderHandler::OnPaint(CefRefPtr<CefBrowser> browser,
                                PaintElementType type,
                                const RectList& dirtyRects, const void* buffer,
                                int width, int height)
{
  GuiPerformance::Timer paintTimer(GuiPerformance::PaintCpu);
  if (type != PET_VIEW) return;
  std::vector<GuiSurface::Rect> rects;
  rects.reserve(dirtyRects.size());
  for (const auto& rect : dirtyRects) rects.push_back({rect.x, rect.y, rect.width, rect.height});
  std::unique_lock<std::mutex> lock(m_textureLock, std::defer_lock);
  { GuiPerformance::Timer wait(GuiPerformance::TextureWait); lock.lock(); }
  m_surface.Push(buffer, width, height, rects);
}

void DX11RenderHandler::GetRenderTargetSize()
{
  Microsoft::WRL::ComPtr<ID3D11RenderTargetView> pRenderTargetView;

  m_pImmediateContext->OMGetRenderTargets(
    1, pRenderTargetView.ReleaseAndGetAddressOf(), nullptr);
  if (pRenderTargetView) {
    Microsoft::WRL::ComPtr<ID3D11Resource> pSrcResource;
    pRenderTargetView->GetResource(pSrcResource.ReleaseAndGetAddressOf());

    if (pSrcResource) {
      Microsoft::WRL::ComPtr<ID3D11Texture2D> pSrcBuffer;
      pSrcResource.As(&pSrcBuffer);

      D3D11_TEXTURE2D_DESC desc;
      pSrcBuffer->GetDesc(&desc);

      if ((m_width != desc.Width || m_height != desc.Height) && m_pParent) {
        m_width = desc.Width;
        m_height = desc.Height;

        if (isCreateLock) {
          // We now know the size of the viewport, we can let CEF get it
          m_createLock.unlock();
          isCreateLock = false;
        }

        {
          std::unique_lock<std::mutex> _(m_textureLock);

          m_pTexture.Reset();
          m_pTextureView.Reset();
        }

        if (m_pParent->GetBrowser())
          m_pParent->GetBrowser()->GetHost()->WasResized();
      }
    }
  }
}

void DX11RenderHandler::CreateRenderTexture()
{
  m_textureReady = false;
  D3D11_TEXTURE2D_DESC textDesc;
  textDesc.Width = m_width;
  textDesc.Height = m_height;
  textDesc.MipLevels = textDesc.ArraySize = 1;
  textDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  textDesc.SampleDesc.Count = 1;
  textDesc.SampleDesc.Quality = 0;
  textDesc.Usage = D3D11_USAGE_DEFAULT;
  textDesc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  textDesc.CPUAccessFlags = 0;
  textDesc.MiscFlags = 0;

  if (FAILED(m_pDevice->CreateTexture2D(&textDesc, nullptr,
                                        m_pTexture.ReleaseAndGetAddressOf())))
    return;

  D3D11_SHADER_RESOURCE_VIEW_DESC sharedResourceViewDesc = {};
  sharedResourceViewDesc.Format = textDesc.Format;
  sharedResourceViewDesc.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE2D;
  sharedResourceViewDesc.Texture2D.MipLevels = 1;

  if (FAILED(m_pDevice->CreateShaderResourceView(
        m_pTexture.Get(), &sharedResourceViewDesc,
        m_pTextureView.ReleaseAndGetAddressOf())))
    return;
}
}
