package ipc

import (
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

const SchemaVersion = "runtime3d.ipc.v1"

type Message struct {
	RequestID     string         `json:"request_id,omitempty"`
	SchemaVersion string         `json:"schema_version"`
	Timestamp     int64          `json:"timestamp"`
	Source        string         `json:"source"`
	Target        string         `json:"target"`
	Event         string         `json:"event"`
	Payload       map[string]any `json:"payload,omitempty"`
}

type Client struct {
	conn net.Conn
	mu   sync.Mutex
}

func NewClient(conn net.Conn) *Client {
	return &Client{conn: conn}
}

func (c *Client) Send(event, source, target string, payload map[string]any, requestID string) error {
	msg := Message{
		RequestID:     requestID,
		SchemaVersion: SchemaVersion,
		Timestamp:     time.Now().UnixMilli(),
		Source:        source,
		Target:        target,
		Event:         event,
		Payload:       payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if _, err := c.conn.Write(append(data, '\n')); err != nil {
		return err
	}
	return nil
}

func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.conn.Close()
}

func ParseMessage(line string) (Message, error) {
	var msg Message
	if err := json.Unmarshal([]byte(line), &msg); err != nil {
		return Message{}, err
	}
	if msg.SchemaVersion == "" {
		msg.SchemaVersion = SchemaVersion
	}
	if msg.Event == "" {
		return Message{}, fmt.Errorf("missing event")
	}
	if msg.Source == "" || msg.Target == "" {
		return Message{}, fmt.Errorf("missing source/target")
	}
	if msg.Timestamp == 0 {
		msg.Timestamp = time.Now().UnixMilli()
	}
	if msg.Payload == nil {
		msg.Payload = map[string]any{}
	}
	return msg, nil
}

func NextRequestID(prefix string) string {
	id := atomic.AddUint64(&requestCounter, 1)
	return fmt.Sprintf("%s-%d", prefix, id)
}

var requestCounter uint64
