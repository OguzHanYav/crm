# Minimal-Telefonanlage für die CRM-Browser-Telefonie (WebRTC <-> SIP-Trunk).
FROM ubuntu:24.04

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      asterisk asterisk-core-sounds-en gettext-base ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY templates/ /templates/
COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
