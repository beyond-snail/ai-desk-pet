package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"strings"

	"ai-desk-pet/runtime3d-native/internal/ipc"
)

const logPrefix = "[runtime3d:qt-sidecar]"

var requiredActions = []string{"chat", "feed", "pet", "clean", "celebrate", "drop"}

type state struct {
	chatRequestReceived bool
	chatDone            bool
	voiceStopSent       bool
	voiceWakeupSent     bool
	ttsSpoken           bool
	appQuitReceived     bool
	appHideSent         bool
	handshakeDone       bool
	actions             map[string]bool
	chatCount           int
}

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--healthcheck":
			fmt.Println("qt-sidecar healthcheck ok (native)")
			return
		case "--version":
			fmt.Println("qt-sidecar native 1.0.0")
			return
		}
	}

	host := envOr("RUNTIME3D_IPC_HOST", "127.0.0.1")
	port := envOr("RUNTIME3D_IPC_PORT", "47831")
	address := net.JoinHostPort(host, port)

	listener, err := net.Listen("tcp", address)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s server error: %v\n", logPrefix, err)
		os.Exit(1)
	}
	defer listener.Close()

	fmt.Printf("%s listening %s\n", logPrefix, address)

	conn, err := listener.Accept()
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s accept error: %v\n", logPrefix, err)
		os.Exit(1)
	}
	defer conn.Close()
	fmt.Printf("%s client connected\n", logPrefix)

	client := ipc.NewClient(conn)
	st := &state{actions: map[string]bool{}}
	scanner := bufio.NewScanner(conn)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		msg, err := ipc.ParseMessage(line)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s invalid message: %v\n", logPrefix, err)
			continue
		}
		fmt.Printf("%s received %s\n", logPrefix, msg.Event)
		handleMessage(msg, client, st)
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "%s socket error: %v\n", logPrefix, err)
		os.Exit(1)
	}

	if st.handshakeDone {
		fmt.Printf("%s handshake ok\n", logPrefix)
		return
	}
	fmt.Fprintf(os.Stderr, "%s closed before handshake completed\n", logPrefix)
	os.Exit(1)
}

func handleMessage(msg ipc.Message, client *ipc.Client, st *state) {
	send := func(event string, payload map[string]any, requestID string) {
		if err := client.Send(event, "qt-sidecar", "godot", payload, requestID); err != nil {
			fmt.Fprintf(os.Stderr, "%s send %s failed: %v\n", logPrefix, event, err)
			return
		}
		fmt.Printf("%s sent %s\n", logPrefix, event)
	}

	switch msg.Event {
	case "app.show":
		send("settings.get", map[string]any{"key": "runtime3d.window.interactive_regions"}, msg.RequestID)
	case "settings.set":
		// noop: settings persisted by native runtime in production build.
	case "settings.get":
		key := asString(msg.Payload, "key")
		send("settings.set", map[string]any{"key": key, "value": nil}, msg.RequestID)
	case "pet.action":
		action := asString(msg.Payload, "action")
		if action != "" {
			st.actions[action] = true
		}
		maybeSendAppHide(send, st)
	case "pet.focus_mode":
		// noop
	case "chat.request":
		st.chatRequestReceived = true
		chunks := []string{"今天先做高优先任务，", "中午前完成一个闭环，", "下午留 30 分钟回顾。", "保持节奏。"}
		for _, chunk := range chunks {
			send("chat.stream_chunk", map[string]any{"chunk": chunk}, msg.RequestID)
		}
		st.chatDone = true
		st.chatCount++
		send("chat.done", map[string]any{"provider": "runtime3d-native"}, msg.RequestID)
		maybeSendAppHide(send, st)
	case "speech.listen.start":
		st.voiceStopSent = true
		send("speech.listen.stop", map[string]any{"mode": "local-keyword"}, msg.RequestID)
		st.voiceWakeupSent = true
		send("pet.voice_wakeup", map[string]any{"wakeword": "你好桌宠"}, msg.RequestID)
		maybeSendAppHide(send, st)
	case "speech.tts.speak":
		text := asString(msg.Payload, "text")
		st.ttsSpoken = text != ""
		send("system.metrics.push", map[string]any{
			"source":       "qt-sidecar.tts",
			"spokenLength": len([]rune(text)),
			"store": map[string]any{
				"chatCount": st.chatCount,
			},
		}, msg.RequestID)
		maybeSendAppHide(send, st)
	case "app.quit":
		st.appQuitReceived = true
		finalOK := hasAllActions(st.actions) && st.chatDone && st.voiceStopSent && st.voiceWakeupSent && st.ttsSpoken && st.appHideSent
		summary := map[string]any{
			"hasAllActions":      hasAllActions(st.actions),
			"chatDone":           st.chatDone,
			"voiceStopSent":      st.voiceStopSent,
			"voiceWakeupSent":    st.voiceWakeupSent,
			"ttsSpoken":          st.ttsSpoken,
			"appHideSent":        st.appHideSent,
			"persistedChatCount": st.chatCount,
		}
		if data, err := json.Marshal(summary); err == nil {
			fmt.Printf("%s interaction_summary %s\n", logPrefix, string(data))
		}
		system := map[string]any{
			"trayReady":        true,
			"hotkeyRegistered": true,
			"windowVisible":    false,
			"lastAction":       "hide_window",
		}
		if data, err := json.Marshal(system); err == nil {
			fmt.Printf("%s system_state %s\n", logPrefix, string(data))
		}
		if finalOK {
			st.handshakeDone = true
			return
		}
		fmt.Fprintf(os.Stderr, "%s interaction checks failed\n", logPrefix)
		os.Exit(1)
	}
}

func maybeSendAppHide(send func(string, map[string]any, string), st *state) {
	if st.appHideSent {
		return
	}
	if !hasAllActions(st.actions) || !st.chatRequestReceived || !st.chatDone || !st.voiceStopSent || !st.voiceWakeupSent || !st.ttsSpoken {
		return
	}
	st.appHideSent = true
	send("app.hide", map[string]any{"reason": "interaction-chain-complete"}, ipc.NextRequestID("apphide"))
}

func hasAllActions(actions map[string]bool) bool {
	for _, action := range requiredActions {
		if !actions[action] {
			return false
		}
	}
	return true
}

func asString(payload map[string]any, key string) string {
	if payload == nil {
		return ""
	}
	v, ok := payload[key]
	if !ok || v == nil {
		return ""
	}
	return fmt.Sprintf("%v", v)
}

func envOr(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
