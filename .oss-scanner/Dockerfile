# syntax=docker/dockerfile:1
# Anthropic OSS Scanner: build the public develop branch without GitHub secrets.
# The scanner clones the repository and builds this Dockerfile with repo root as context.
FROM ghcr.io/geniusventures/almalinux-8:latest

ENV CI=1 \
    NODE_ENV=development \
    HARDHAT_NETWORK=hardhat \
    PYTHON=/usr/bin/python3.9

# The CIDocker image supplies Node 24, Clang, git, and the native build toolchain.
# Python 3.9 is for node-gyp; AlmaLinux 8's default Python 3.6 is too old.
RUN dnf install -y python39 python39-pip && dnf clean all

# The diamonds-hardhat-foundry plugin calls forge at Hardhat config load.
# Install a pinned, SHA-256-checked Foundry release before compiling contracts.
RUN curl -fL --retry 3 --retry-delay 3 \
      "https://github.com/foundry-rs/foundry/releases/download/v1.8.5/foundry_v1.8.5_linux_amd64.tar.gz" \
      -o /tmp/foundry.tar.gz \
 && echo "6c66ffcc55fa4249197721baa3098bc208014ea1d8aa04b2ed50ac6bccffb226  /tmp/foundry.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/foundry.tar.gz -C /usr/local/bin forge cast anvil chisel \
 && chmod 0755 /usr/local/bin/forge /usr/local/bin/cast /usr/local/bin/anvil /usr/local/bin/chisel \
 && rm -f /tmp/foundry.tar.gz \
 && forge --version

WORKDIR /src
COPY . /src

# Keep the checkout's pinned gitlink SHAs, including the Solidity contract tree.
# Public modules use SSH-form URLs; rewrite to anonymous HTTPS for the scanner.
RUN git config --global --add url."https://github.com/".insteadOf "git@github.com:" \
 && git submodule sync --recursive \
 && git submodule update --init --recursive

# Use the committed Yarn 4 binary, not a moving global Yarn/corepack version.
RUN test -s .yarn/releases/yarn-4.10.3.cjs \
 && node .yarn/releases/yarn-4.10.3.cjs install --immutable

# Cache Solidity compilers, build outputs, TypeChain bindings and diamond ABIs
# while build-time network access exists. The resulting image is audited offline.
RUN node .yarn/releases/yarn-4.10.3.cjs compile \
 && test -d node_modules \
 && test -d artifacts \
 && test -d diamond-typechain-types

# Only local Hardhat tests belong in the offline scan. Avoid external fork RPCs,
# deployment scripts, wallet keys, and API credentials.
CMD ["/bin/bash"]
