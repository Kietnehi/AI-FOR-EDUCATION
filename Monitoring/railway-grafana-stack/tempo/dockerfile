ARG VERSION=2.9.0

FROM grafana/tempo:${VERSION}

COPY tempo.yml /etc/tempo/tempo.yml

CMD ["-config.file=/etc/tempo/tempo.yml"]