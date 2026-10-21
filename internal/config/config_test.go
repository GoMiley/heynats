package config

import (
	"log/slog"
	"reflect"
	"testing"
)

func envOf(vars map[string]string) func(string) string {
	return func(key string) string { return vars[key] }
}

// required is the smallest valid environment.
func required(extra map[string]string) map[string]string {
	env := map[string]string{
		"NATS_SERVERS":       "nats://nats-a:4222, nats://nats-b:4222",
		"NATS_USER":          "dashboard",
		"NATS_PASSWORD":      "secret",
		"DASHBOARD_USER":     "ops",
		"DASHBOARD_PASSWORD": "pw",
	}
	for k, v := range extra {
		env[k] = v
	}
	return env
}

func TestLoad(t *testing.T) {
	base := Config{
		HTTPAddr:          ":5000",
		LogLevel:          slog.LevelInfo,
		LogFormat:         "text",
		NatsServers:       []string{"nats://nats-a:4222", "nats://nats-b:4222"},
		NatsUser:          "dashboard",
		NatsPassword:      "secret",
		DashboardUser:     "ops",
		DashboardPassword: "pw",
		ReadOnly:          true,
		LiveTap:           true,
	}
	with := func(f func(*Config)) Config {
		c := base
		c.NatsServers = append([]string(nil), base.NatsServers...)
		f(&c)
		return c
	}
	tests := []struct {
		name string
		args []string
		env  map[string]string
		want Config
	}{
		{"defaults: read-only, live tap on, no $SYS, no base path", nil, required(nil), base},
		{"env", nil, required(map[string]string{
			"HEYNATS_HTTP_ADDR":  ":8080",
			"HEYNATS_LOG_LEVEL":  "debug",
			"HEYNATS_LOG_FORMAT": "json",
			"BASE_PATH":          "/nats/",
			"READONLY":           "false",
			"SYS_INFO":           "true",
		}), with(func(c *Config) {
			c.HTTPAddr, c.LogLevel, c.LogFormat = ":8080", slog.LevelDebug, "json"
			c.BasePath, c.ReadOnly, c.SysInfo = "/nats", false, true
		})},
		{"live tap off", nil, required(map[string]string{"LIVE_TAP": "false"}), with(func(c *Config) { c.LiveTap = false })},
		{"live tap off as 0", nil, required(map[string]string{"LIVE_TAP": "0"}), with(func(c *Config) { c.LiveTap = false })},
		{"live tap off as Off", nil, required(map[string]string{"LIVE_TAP": " Off "}), with(func(c *Config) { c.LiveTap = false })},
		{"base path without slashes", nil, required(map[string]string{"BASE_PATH": "nats"}), with(func(c *Config) { c.BasePath = "/nats" })},
		{"flag beats env", []string{"-addr", ":9090"}, required(map[string]string{"HEYNATS_HTTP_ADDR": ":8080"}),
			with(func(c *Config) { c.HTTPAddr = ":9090" })},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Load(tt.args, envOf(tt.env))
			if err != nil || !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("Load = %+v, %v; want %+v", got, err, tt.want)
			}
		})
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	for _, env := range []map[string]string{
		required(map[string]string{"HEYNATS_LOG_LEVEL": "loud"}),
		required(map[string]string{"HEYNATS_LOG_FORMAT": "xml"}),
		required(map[string]string{"BASE_PATH": "/nats/../x"}),
		required(map[string]string{"BASE_PATH": "/nats\"><script>"}),
		required(map[string]string{"NATS_SERVERS": " "}),
		required(map[string]string{"DASHBOARD_USER": ""}),
		required(map[string]string{"DASHBOARD_PASSWORD": ""}),
	} {
		if _, err := Load(nil, envOf(env)); err == nil {
			t.Errorf("Load(%v) accepted invalid value", env)
		}
	}
}
