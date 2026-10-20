package config

import (
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"strings"
)

type Config struct {
	HTTPAddr  string
	LogLevel  slog.Level
	LogFormat string

	// The one NATS the server connects to. The browser never picks a host or
	// credentials: these come from the environment only.
	NatsServers  []string
	NatsUser     string
	NatsPassword string

	// HTTP basic auth on every route (assets included), except BasePath+"/healthz".
	DashboardUser     string
	DashboardPassword string

	// The path the dashboard is served under ("" or e.g. "/nats"), for assets and API alike.
	BasePath string

	// ReadOnly hides every write in the UI and makes the server refuse them.
	ReadOnly bool

	// SysInfo queries the $SYS account (CONNZ, USER.INFO). Off by default: a
	// user without $SYS permissions would make NATS log an error per poll.
	SysInfo bool
}

// Load reads env vars, then command-line flags (flags win).
func Load(args []string, getenv func(string) string) (Config, error) {
	env := func(key, def string) string {
		if v := getenv(key); v != "" {
			return v
		}
		return def
	}

	fs := flag.NewFlagSet("heynats", flag.ContinueOnError)
	addr := fs.String("addr", env("HEYNATS_HTTP_ADDR", ":5000"), "HTTP listen address")
	level := fs.String("log-level", env("HEYNATS_LOG_LEVEL", "info"), "debug, info, warn or error")
	format := fs.String("log-format", env("HEYNATS_LOG_FORMAT", "text"), "text or json")
	basePath := fs.String("base-path", env("BASE_PATH", ""), "path prefix the dashboard is served under, e.g. /nats")
	readOnly := fs.Bool("readonly", env("READONLY", "true") != "false", "refuse every write (READONLY=false to allow them)")
	sysInfo := fs.Bool("sys-info", env("SYS_INFO", "false") == "true", "query the $SYS account for connection and user info")
	if err := fs.Parse(args); err != nil {
		return Config{}, err
	}

	cfg := Config{
		HTTPAddr:          *addr,
		LogFormat:         *format,
		NatsUser:          getenv("NATS_USER"),
		NatsPassword:      getenv("NATS_PASSWORD"),
		DashboardUser:     getenv("DASHBOARD_USER"),
		DashboardPassword: getenv("DASHBOARD_PASSWORD"),
		ReadOnly:          *readOnly,
		SysInfo:           *sysInfo,
	}
	if err := cfg.LogLevel.UnmarshalText([]byte(*level)); err != nil {
		return Config{}, fmt.Errorf("invalid log level %q", *level)
	}
	if cfg.LogFormat != "text" && cfg.LogFormat != "json" {
		return Config{}, fmt.Errorf("invalid log format %q", cfg.LogFormat)
	}
	for _, s := range strings.Split(getenv("NATS_SERVERS"), ",") {
		if s = strings.TrimSpace(s); s != "" {
			cfg.NatsServers = append(cfg.NatsServers, s)
		}
	}
	bp, err := normalizeBasePath(*basePath)
	if err != nil {
		return Config{}, err
	}
	cfg.BasePath = bp

	var missing []string
	if len(cfg.NatsServers) == 0 {
		missing = append(missing, "NATS_SERVERS")
	}
	if cfg.DashboardUser == "" {
		missing = append(missing, "DASHBOARD_USER")
	}
	if cfg.DashboardPassword == "" {
		missing = append(missing, "DASHBOARD_PASSWORD")
	}
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required settings: %s", strings.Join(missing, ", "))
	}
	return cfg, nil
}

// normalizeBasePath turns "nats", "/nats/" and "/nats" into "/nats"; "" and "/" into "".
func normalizeBasePath(p string) (string, error) {
	p = strings.Trim(strings.TrimSpace(p), "/")
	if p == "" {
		return "", nil
	}
	if strings.ContainsAny(p, " ?#\"'<>\\") || strings.Contains(p, "..") {
		return "", errors.New("BASE_PATH may contain only a plain path, e.g. /nats")
	}
	return "/" + p, nil
}
