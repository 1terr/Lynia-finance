# =====================================================
# Pentaho Server CE 9.5 + PDI (Kettle) for Lynia Finance
#
# This container serves two purposes:
# 1. Pentaho Server: Hosts reports and dashboards (port 8080)
# 2. PDI (Kettle): Runs ETL jobs via kitchen.sh and pan.sh
#
# For Lynia's architecture, we run the nightly ETL as a
# separate ECS Scheduled Task using the same image but
# with a different entrypoint (run_nightly_etl.sh).
# =====================================================

FROM eclipse-temurin:11-jre-jammy

LABEL maintainer="Lynia Finance <dev@lyniafinance.com>"
LABEL description="Pentaho Server CE 9.5 for BI reporting and ETL"

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    postgresql-client \
    python3 \
    awscli \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Environment variables
ENV PENTAHO_HOME=/opt/pentaho
ENV PENTAHO_SERVER=${PENTAHO_HOME}/pentaho-server
ENV PDI_HOME=${PENTAHO_HOME}/data-integration
ENV JAVA_OPTS="-Xms512m -Xmx1536m"

# Create pentaho user (non-root)
RUN groupadd -r pentaho && useradd -r -g pentaho -d ${PENTAHO_HOME} pentaho

# Download and install Pentaho Server CE 9.5
WORKDIR /tmp
RUN wget -q "https://sourceforge.net/projects/pentaho/files/Pentaho-9.5/server/pentaho-server-ce-9.5.0.0-272.zip/download" \
    -O pentaho-server.zip \
    && mkdir -p ${PENTAHO_HOME} \
    && unzip -q pentaho-server.zip -d ${PENTAHO_HOME} \
    && rm pentaho-server.zip

# Download and install PDI (Data Integration / Kettle) 9.5
RUN wget -q "https://sourceforge.net/projects/pentaho/files/Pentaho-9.5/client-tools/pdi-ce-9.5.0.0-272.zip/download" \
    -O pdi.zip \
    && unzip -q pdi.zip -d ${PENTAHO_HOME} \
    && rm pdi.zip

# Install PostgreSQL JDBC driver
RUN wget -q "https://jdbc.postgresql.org/download/postgresql-42.7.2.jar" \
    -O ${PENTAHO_SERVER}/tomcat/lib/postgresql-42.7.2.jar \
    && cp ${PENTAHO_SERVER}/tomcat/lib/postgresql-42.7.2.jar \
       ${PDI_HOME}/lib/postgresql-42.7.2.jar

# Copy ETL transformations and jobs
COPY ../../services/pentaho-etl/ ${PENTAHO_HOME}/etl/

# Set permissions
RUN chown -R pentaho:pentaho ${PENTAHO_HOME}

# Switch to pentaho user
USER pentaho
WORKDIR ${PENTAHO_HOME}

# Expose Pentaho Server port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/pentaho/Login || exit 1

# Default: run Pentaho Server
# Override with run_nightly_etl.sh for ETL scheduled tasks
CMD ["bash", "-c", "${PENTAHO_SERVER}/start-pentaho.sh"]
