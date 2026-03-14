package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"math"
	"net"
	"os"
	"strings"
	"sync"
	"time"

	"ai-desk-pet/runtime3d-native/internal/ipc"
)

const logPrefix = "[runtime3d:godot]"

type runtimeState struct {
	scenario             string
	chatReply            strings.Builder
	ttsRequested         bool
	voiceWakeupReceived  bool
	interactionTriggered bool
	appQuitSent          bool
	loopTicks            int
	mu                   sync.Mutex
}

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--healthcheck":
			fmt.Println("godot-runtime healthcheck ok (native)")
			return
		case "--version":
			fmt.Println("godot-runtime native 1.0.0")
			return
		}
	}

	host := envOr("RUNTIME3D_IPC_HOST", "127.0.0.1")
	port := envOr("RUNTIME3D_IPC_PORT", "47831")
	scenario := envOr("RUNTIME3D_SCENARIO", "interaction-smoke")
	address := net.JoinHostPort(host, port)

	conn, err := connectWithRetry(address, 120, 50*time.Millisecond)
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s socket error: %v\n", logPrefix, err)
		os.Exit(1)
	}
	defer conn.Close()
	fmt.Printf("%s connected %s\n", logPrefix, address)

	client := ipc.NewClient(conn)
	state := &runtimeState{scenario: scenario}

	stopLoop := make(chan struct{})
	go mainLoop(client, state, stopLoop)

	send(client, "app.show", map[string]any{"reason": scenario}, ipc.NextRequestID("show"))

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
		handleMessage(client, state, msg)
	}
	close(stopLoop)
	state.mu.Lock()
	appQuitSent := state.appQuitSent
	loopTicks := state.loopTicks
	chatReplyLength := len([]rune(state.chatReply.String()))
	voiceWakeupReceived := state.voiceWakeupReceived
	state.mu.Unlock()

	if err := scanner.Err(); err != nil && !appQuitSent {
		fmt.Fprintf(os.Stderr, "%s socket error: %v\n", logPrefix, err)
		os.Exit(1)
	}

	if appQuitSent {
		summary := map[string]any{
			"loopTicks":           loopTicks,
			"chatReplyLength":     chatReplyLength,
			"voiceWakeupReceived": voiceWakeupReceived,
		}
		if data, err := json.Marshal(summary); err == nil {
			fmt.Printf("%s interaction_summary %s\n", logPrefix, string(data))
		}
		fmt.Printf("%s handshake ok\n", logPrefix)
		return
	}

	if strings.Contains(strings.ToLower(scenario), "daemon") {
		fmt.Printf("%s daemon shutdown\n", logPrefix)
		return
	}
	fmt.Fprintf(os.Stderr, "%s closed before handshake completed\n", logPrefix)
	os.Exit(1)
}

func connectWithRetry(address string, attempts int, delay time.Duration) (net.Conn, error) {
	var lastErr error
	for i := 0; i < attempts; i++ {
		conn, err := net.Dial("tcp", address)
		if err == nil {
			return conn, nil
		}
		lastErr = err
		time.Sleep(delay)
	}
	return nil, fmt.Errorf("connect %s failed: %w", address, lastErr)
}

func mainLoop(client *ipc.Client, state *runtimeState, stop <-chan struct{}) {
	ticker := time.NewTicker(16 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			state.mu.Lock()
			state.loopTicks++
			loopTicks := state.loopTicks
			scenario := state.scenario
			appQuitSent := state.appQuitSent
			state.mu.Unlock()
			if appQuitSent {
				return
			}
			if loopTicks%120 == 0 {
				send(client, "system.metrics.push", map[string]any{
					"source":       "godot.main_loop",
					"loopTicks":    loopTicks,
					"locomotion":   locomotionState(loopTicks),
					"roamingState": roamingState(loopTicks),
					"scenario":     scenario,
				}, ipc.NextRequestID("metrics"))
			}
		case <-stop:
			return
		}
	}
}

func handleMessage(client *ipc.Client, state *runtimeState, msg ipc.Message) {
	fmt.Printf("%s received %s\n", logPrefix, msg.Event)

	switch msg.Event {
	case "settings.get":
		send(client, "settings.set", map[string]any{
			"key": "runtime3d.window.interactive_regions",
			"value": []map[string]int{
				{"x": 120, "y": 88, "width": 220, "height": 220},
				{"x": 96, "y": 312, "width": 310, "height": 126},
			},
		}, msg.RequestID)
		triggerInteractionScenario(client, state)
	case "chat.stream_chunk":
		chunk := asString(msg.Payload, "chunk")
		state.mu.Lock()
		state.chatReply.WriteString(chunk)
		state.mu.Unlock()
	case "chat.done":
		state.mu.Lock()
		ttsRequested := state.ttsRequested
		reply := state.chatReply.String()
		if !ttsRequested {
			state.ttsRequested = true
		}
		state.mu.Unlock()
		if !ttsRequested {
			send(client, "speech.tts.speak", map[string]any{"text": reply, "voice": "local-default"}, msg.RequestID)
		}
	case "chat.error":
		state.mu.Lock()
		ttsRequested := state.ttsRequested
		if !ttsRequested {
			state.ttsRequested = true
		}
		state.mu.Unlock()
		if !ttsRequested {
			send(client, "speech.tts.speak", map[string]any{"text": "网络暂时拥挤，我先陪你休息一下。", "voice": "local-default"}, msg.RequestID)
		}
	case "pet.voice_wakeup":
		state.mu.Lock()
		state.voiceWakeupReceived = true
		state.mu.Unlock()
		send(client, "pet.action", map[string]any{"action": "celebrate", "trigger": "voice_wakeup"}, msg.RequestID)
		send(client, "pet.action", map[string]any{"action": "drop", "trigger": "drag_drop"}, msg.RequestID)
	case "speech.listen.stop":
		send(client, "pet.focus_mode", map[string]any{"enabled": false, "source": "voice_stop"}, msg.RequestID)
	case "app.hide":
		state.mu.Lock()
		state.appQuitSent = true
		loopTicks := state.loopTicks
		voiceWakeup := state.voiceWakeupReceived
		replyLen := len([]rune(state.chatReply.String()))
		state.mu.Unlock()
		send(client, "app.quit", map[string]any{
			"reason":              "interaction-smoke-complete",
			"loopTicks":           loopTicks,
			"voiceWakeupReceived": voiceWakeup,
			"ttsRequested":        true,
			"chatReplyLength":     replyLen,
		}, msg.RequestID)
		go func() {
			time.Sleep(30 * time.Millisecond)
			_ = client.Close()
		}()
	}
}

func triggerInteractionScenario(client *ipc.Client, state *runtimeState) {
	state.mu.Lock()
	if state.interactionTriggered {
		state.mu.Unlock()
		return
	}
	scenario := strings.ToLower(state.scenario)
	if !strings.Contains(scenario, "interaction") {
		state.mu.Unlock()
		return
	}
	state.interactionTriggered = true
	state.mu.Unlock()

	send(client, "pet.action", map[string]any{"action": "chat", "trigger": "single_click"}, ipc.NextRequestID("act"))
	send(client, "pet.action", map[string]any{"action": "feed", "trigger": "menu"}, ipc.NextRequestID("act"))
	send(client, "pet.action", map[string]any{"action": "pet", "trigger": "menu"}, ipc.NextRequestID("act"))
	send(client, "pet.action", map[string]any{"action": "clean", "trigger": "menu"}, ipc.NextRequestID("act"))

	send(client, "chat.request", map[string]any{
		"text":       "今天的专注安排是什么？",
		"provider":   "runtime3d-native",
		"limit_mode": "daily",
	}, ipc.NextRequestID("chat"))

	send(client, "speech.listen.start", map[string]any{
		"mode":     "local-keyword",
		"keywords": []string{"你好桌宠", "过来", "走开", "喂食"},
	}, ipc.NextRequestID("voice"))
	send(client, "pet.focus_mode", map[string]any{"enabled": true, "source": "voice_start"}, ipc.NextRequestID("focus"))
}

func send(client *ipc.Client, event string, payload map[string]any, requestID string) {
	if err := client.Send(event, "godot", "qt-sidecar", payload, requestID); err != nil {
		fmt.Fprintf(os.Stderr, "%s send %s failed: %v\n", logPrefix, event, err)
		return
	}
	fmt.Printf("%s sent %s\n", logPrefix, event)
}

func locomotionState(loopTicks int) string {
	phase := loopTicks % 500
	switch {
	case phase < 70:
		return "idle"
	case phase < 120:
		return "start_walk"
	case phase < 330:
		return "walk"
	case phase < 390:
		return "turn"
	default:
		return "stop"
	}
}

func roamingState(loopTicks int) string {
	wave := math.Sin(float64(loopTicks) / 60)
	switch {
	case wave > 0.55:
		return "offscreen"
	case wave < -0.55:
		return "returning"
	default:
		return "onscreen"
	}
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
