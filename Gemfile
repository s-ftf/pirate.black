source "https://rubygems.org"

# Match the GitHub Pages build environment.
gem "github-pages", "~> 228", group: :jekyll_plugins

# Required by Jekyll 3.9 and its dependencies on newer Ruby versions.
gem "base64"
gem "bigdecimal"
gem "csv"
gem "webrick"

# Time zone data and file watching support for Windows and JRuby contributors.
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

gem "wdm", "~> 0.1.1", platforms: [:mingw, :x64_mingw, :mswin]

# Newer http_parser.rb releases do not support JRuby.
gem "http_parser.rb", "~> 0.6.0", platforms: [:jruby]
