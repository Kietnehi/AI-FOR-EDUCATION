
  return (
    <div
      className="fixed z-50"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {isChatOpen && (
        <div
          className="absolute bottom-[148px] right-0"
          style={{
            width: `${chatPanelWidth}px`,
            maxWidth: `calc(100vw - 24px)`,
            height: `${chatPanelHeight}px`,
          }}
        >
          {/* Main chat panel */}
          <div
            ref={chatPanelRef}
            className="w-full h-full rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-2xl flex flex-col overflow-hidden"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-light)] bg-[var(--bg-secondary)] flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <BotIcon className="w-4 h-4 text-brand-500" />
                Chat Mascot
              </div>
              <div className="flex items-center gap-1">
                <button
                  className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${showSettings ? "bg-brand-100 text-brand-600" : "text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"}`}
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label="Cài đặt chatbot"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]"
                  onClick={() => setIsChatOpen(false)}
                  aria-label="Đóng khung chat mascot"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="p-3 bg-[var(--bg-secondary)] border-b border-[var(--border-light)] space-y-2 flex-shrink-0">
                <label className="text-xs font-medium text-[var(--text-secondary)] block">Model STT</label>
                <select
                  value={sttModel}
                  onChange={(e) => setSttModel(e.target.value as "local-base" | "whisper-large-v3" | "whisper-large-v3-turbo")}
                  className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-light)] text-[var(--text-primary)] focus:outline-none focus:border-brand-400"
                >
                  <option value="local-base">Local - Whisper base</option>
                  <option value="whisper-large-v3">Groq - whisper-large-v3</option>
                  <option value="whisper-large-v3-turbo">Groq - whisper-large-v3-turbo</option>
                </select>

                <label className="text-xs font-medium text-[var(--text-secondary)] block">Ngôn ngữ TTS</label>
                <select
                  value={ttsLang}
                  onChange={(e) => setTtsLang(e.target.value)}
                  className="w-full text-xs rounded-lg px-2 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-light)] text-[var(--text-primary)] focus:outline-none focus:border-brand-400"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                  <option value="zh-CN">Chinese (CN)</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
            )}

            {/* Messages area */}
            <div ref={messagesRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[var(--bg-primary)]" style={{ minHeight: 0 }}>
              {messages.map((msg, index) => {
                const messageKey = `${msg.role}-${index}`;
                return (
                  <div
                    key={messageKey}
                    className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "ml-auto bg-brand-600 text-white"
                        : "bg-[var(--bg-elevated)] border border-[var(--border-light)] text-[var(--text-primary)]"
                    }`}
                  >
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {msg.images.map((img, idx) => (
                          <div key={idx} className="w-12 h-12 rounded border border-white/20 overflow-hidden bg-black/10">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="msg img" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.content}
                    {msg.role === "assistant" && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleToggleSpeak(messageKey, msg.content)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          aria-label={speakingMessageKey === messageKey ? "Dừng đọc nội dung" : "Đọc nội dung"}
                        >
                          {speakingMessageKey === messageKey ? (
                            <VolumeX className="w-3 h-3" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                          {speakingMessageKey === messageKey ? "Dừng" : "Nghe"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="max-w-[88%] rounded-xl px-3 py-2 text-sm border border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  Đang trả lời...
                </div>
              )}
              {isTranscribing && (
                <div className="max-w-[88%] rounded-xl px-3 py-2 text-sm border border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang chuyển giọng nói...
                </div>
              )}
            </div>

            {/* TTS Panel */}
            {ttsAudioUrl && speakingMessageKey && (
              <div className="px-3 pb-3 pt-2 bg-[var(--bg-primary)] border-t border-[var(--border-light)] flex-shrink-0">
                <div className="rounded-xl border border-brand-200/60 bg-gradient-to-br from-brand-50/80 to-white p-2.5 shadow-sm">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <Volume2 className="w-3 h-3" />
                      </span>
                      <span className="font-medium">Đang phát TTS: {Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTtsPanelCollapsed((prev) => !prev)}
                      className="rounded-full border border-brand-200 bg-white px-2 py-0.5 font-medium hover:bg-brand-50 hover:text-brand-700 transition-colors"
                    >
                      {isTtsPanelCollapsed ? "Hiện" : "Ẩn"}
                    </button>
                  </div>

                  <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
                      style={{ width: `${Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%` }}
                    />
                  </div>

                  <audio
                    ref={ttsAudioRef}
                    src={ttsAudioUrl}
                    controls={!isTtsPanelCollapsed}
                    className={isTtsPanelCollapsed ? "hidden" : "w-full h-8"}
                    onLoadedMetadata={(e) => setTtsDuration((e.target as HTMLAudioElement).duration || 0)}
                    onTimeUpdate={(e) => {
                      const audio = e.target as HTMLAudioElement;
                      setTtsCurrentTime(audio.currentTime || 0);
                      setTtsDuration(audio.duration || 0);
                    }}
                    onEnded={() => resetTtsState()}
                    onError={() => resetTtsState()}
                  />

                  <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span>{formatTime(ttsCurrentTime)} / {formatTime(ttsDuration)}</span>
                    <span>Tiến độ: {Math.round((ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0) * 100)}%</span>
                  </div>

                  {!isTtsPanelCollapsed && (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={ttsDuration || 0}
                        step={0.1}
                        value={Math.min(ttsCurrentTime, ttsDuration || 0)}
                        onChange={(e) => {
                          const nextTime = Number(e.target.value);
                          if (ttsAudioRef.current) {
                            ttsAudioRef.current.currentTime = nextTime;
                          }
                          setTtsCurrentTime(nextTime);
                        }}
                        className="mt-1 w-full accent-brand-600"
                        aria-label="Thanh tua âm thanh"
                      />
                      <p className="mt-1 text-[11px] text-[var(--text-tertiary)] line-clamp-1">
                        Đoạn đang đọc: {getApproxReadingSegment(ttsActiveText, ttsDuration > 0 ? ttsCurrentTime / ttsDuration : 0)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Input area */}
            <div className="p-3 border-t border-[var(--border-light)] bg-[var(--bg-elevated)] flex flex-col gap-2 flex-shrink-0">
              {chatImages.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pb-1">
                  {chatImages.map((img, idx) => (
                    <div key={idx} className="relative group w-12 h-12 rounded-lg border border-[var(--border-light)] overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt="preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeChatImage(idx)}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="mb-0 cursor-pointer flex-shrink-0">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isSending || isRecording || isTranscribing || chatImages.length >= 5}
                  />
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                    transition-all duration-200 border border-[var(--border-light)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]
                    ${(chatImages.length >= 5 || isSending) ? "opacity-50 cursor-not-allowed" : "hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50"}
                  `}>
                    <ImageIcon className="w-4 h-4" />
                  </div>
                </label>
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onPaste={handlePaste}
                  placeholder="Nhập tin nhắn..."
                  disabled={isRecording || isTranscribing}
                  className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-light)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-brand-400 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSending || isTranscribing}
                  className={`w-10 h-10 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                    isRecording
                      ? "bg-rose-500 text-white hover:bg-rose-600"
                      : "bg-emerald-500 text-white hover:bg-emerald-600"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isRecording ? (
                    <Square className="w-3 h-3" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || isRecording || isTranscribing || (!chatInput.trim() && chatImages.length === 0)}
                  className="w-10 h-10 flex-shrink-0 rounded-lg bg-brand-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Gửi tin nhắn mascot"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Resize handles - 4 corners */}
          {/* Top-left */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, "tl")}
            className={`absolute -top-2 -left-2 w-5 h-5 cursor-nwse-resize transition-all rounded-tl-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(315deg, transparent 50%, #6366f1 50%)", zIndex: 20 }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Top-right */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, "tr")}
            className={`absolute -top-2 -right-2 w-5 h-5 cursor-nesw-resize transition-all rounded-tr-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(225deg, transparent 50%, #6366f1 50%)", zIndex: 20 }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Bottom-left */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, "bl")}
            className={`absolute -bottom-2 -left-2 w-5 h-5 cursor-nesw-resize transition-all rounded-bl-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(45deg, transparent 50%, #6366f1 50%)", zIndex: 20 }}
            title="Kéo để thay đổi kích thước"
          />
          {/* Bottom-right */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, "br")}
            className={`absolute -bottom-2 -right-2 w-5 h-5 cursor-nwse-resize transition-all rounded-br-xl ${
              isResizing ? "bg-brand-400 opacity-100" : "opacity-30 hover:opacity-80 hover:bg-brand-300"
            }`}
            style={{ background: "linear-gradient(135deg, transparent 50%, #6366f1 50%)", zIndex: 20 }}
            title="Kéo để thay đổi kích thước"
          />
        </div>
      )}

      {/* The Mascot */}
      <div
        className={`relative w-32 h-32 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onClick={handleMascotClick}
        onMouseMove={handleMouseMoveMark}
        role="button"
        aria-label="Mascot AI có thể kéo thả"
        tabIndex={0}
      >
        <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 1.5]} performance={{ min: 0.5 }}>
          <ambientLight intensity={1} />
          <directionalLight position={[5, 5, 5]} intensity={1.5} color="#ffffff" />
          <directionalLight position={[-5, -5, 2]} intensity={0.5} color="#ec4899" />
          <Bot />
        </Canvas>
      </div>
    </div>
  );
}
