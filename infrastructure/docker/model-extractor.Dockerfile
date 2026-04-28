ARG MODEL_IMAGE=docker.io/phi4:14B-Q4_0

FROM ${MODEL_IMAGE} AS model

FROM busybox:1.36

COPY --from=model / /model-source
COPY infrastructure/docker/model-extract.sh /usr/local/bin/model-extract.sh

ENTRYPOINT ["/bin/sh", "/usr/local/bin/model-extract.sh"]