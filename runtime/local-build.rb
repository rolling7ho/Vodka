# Runs the build job of runtime-up/.github/workflows/build.yml on this Mac,
# the way the self-hosted runner would, without GitHub Actions.
#
#   ruby local-build.rb [first-step-name]
#
# RECIPE names the recipe checkout (default runtime-up); WINECX_COMMIT and
# RUNTIME_VERSION_OVERRIDE pick the wine tree and the stamped version.
#
# Each step runs in bash -e from the workspace (GitHub's default shell), with GITHUB_ENV,
# GITHUB_OUTPUT and GITHUB_STEP_SUMMARY emulated as files, so a step's exports
# reach the next one. Steps that only make sense on GitHub (uses:, hosted-only,
# upload, kosmickrisp) are skipped.
require "yaml"
require "fileutils"

WS = File.expand_path(ENV.fetch("RECIPE", "runtime-up"), __dir__)
STATE = File.join(WS, ".local-ci")
FileUtils.mkdir_p(STATE)

INPUTS = {
  "opt" => "release",
  "runtime_version" => ENV.fetch("RUNTIME_VERSION_OVERRIDE", "4.8.0"),
  "runner" => "self-hosted",
}

# Our fork: the recipe's wine plus the retina fix for hosted Metal layers.
# 11.19 (00ccdd76) builds but every process faults at startup, so the
# default is 11.17 (b21cca2b), the tree upstream's runtime 4.7.3 shipped.
OVERRIDES = {
  "WINECX_REPO" => "https://github.com/rolling7ho/winecx.git",
  "WINECX_COMMIT" => ENV.fetch("WINECX_COMMIT", "b21cca2b987bd6da25c75b4ff1f11c523c0dc4cd"),
  # Whisky's own floor. Upstream moved to 26.0; the availability error flags
  # turn anything above 15.0 into a compile error rather than a crash.
  "MACOSX_DEPLOYMENT_TARGET" => ENV.fetch("FLOOR", "15.0"),
  "KOSMICKRISP_ENABLED" => "false",
}

SKIP = /hosted|kosmickrisp|upload|always\(\)/

def expand(str)
  str.to_s
     .gsub(/\$\{\{\s*inputs\.runtime_version \|\| ''\s*\}\}/) { INPUTS["runtime_version"] }
     .gsub(/\$\{\{\s*inputs\.(\w+)\s*\}\}/) { INPUTS.fetch(Regexp.last_match(1), "") }
     .gsub(/\$\{\{\s*env\.(\w+)\s*\}\}/) { ENV.fetch(Regexp.last_match(1), "") }
end

def load_kv(path)
  return {} unless File.exist?(path)
  File.readlines(path, chomp: true).each_with_object({}) do |line, h|
    k, v = line.split("=", 2)
    h[k] = v if k && v && k.match?(/\A\w+\z/)
  end
end

wf = YAML.load_file(File.join(WS, ".github/workflows/build.yml"))
env = wf["env"].transform_values { |v| expand(v) }.merge(OVERRIDES)
env.each { |k, v| ENV[k] = v.to_s }
ENV["GITHUB_WORKSPACE"] = WS
ENV["RUNNER_TEMP"] = File.join(STATE, "tmp")
FileUtils.mkdir_p(ENV["RUNNER_TEMP"])

# Resuming from a later step needs what the earlier steps exported.
load_kv(File.join(STATE, "env")).each { |k, v| ENV[k] = v } if ARGV[0]

start = ARGV[0]
started = start.nil?
steps = wf.dig("jobs", "build", "steps")
steps.each_with_index do |step, i|
  name = step["name"] || step["uses"]
  started ||= name == start
  next unless started
  if step["uses"] || step["if"].to_s.match?(SKIP) || name.match?(SKIP)
    puts "== skip: #{name}"
    next
  end
  env_file = File.join(STATE, "env")
  out_file = File.join(STATE, "out-#{i}")
  FileUtils.touch(env_file)
  ENV["GITHUB_ENV"] = env_file
  ENV["GITHUB_OUTPUT"] = out_file
  ENV["GITHUB_STEP_SUMMARY"] = File.join(STATE, "summary.md")
  ENV["GITHUB_PATH"] = File.join(STATE, "path")
  (step["env"] || {}).each { |k, v| ENV[k] = expand(v) }
  script = File.join(STATE, format("step-%02d.sh", i))
  File.write(script, expand(step["run"]))
  puts "== step: #{name}  (#{Time.now.strftime('%H:%M:%S')})"
  ok = system("/bin/bash", "--noprofile", "--norc", "-e", script, chdir: WS)
  abort "== FAILED: #{name}" unless ok
  load_kv(env_file).each { |k, v| ENV[k] = v }
  if File.exist?(ENV["GITHUB_PATH"])
    extra = File.readlines(ENV["GITHUB_PATH"], chomp: true).reject(&:empty?)
    ENV["PATH"] = (extra + [ENV["PATH"]]).join(":") unless extra.empty?
  end
end
puts "== done  (#{Time.now.strftime('%H:%M:%S')})"
