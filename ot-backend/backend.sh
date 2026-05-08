#!/bin/bash
set -e

echo ""
echo "  OT Backend - Local Dev"
echo "  ---------------------------------"
echo "  URL     : http://localhost:8085"
echo "  Profile : local (application-local.properties)"
echo "  DB      : Supabase"
echo "  Press Ctrl+C to stop"
echo ""

if ! command -v java &>/dev/null; then
    echo "ERROR: Java is not installed. Install Java 21 from https://adoptium.net"
    exit 1
fi

JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1)
if [ "$JAVA_VER" -lt 21 ] 2>/dev/null; then
    echo "ERROR: Java 21+ required (found Java $JAVA_VER)"
    exit 1
fi

cd "$(dirname "$0")"
chmod +x mvnw

./mvnw spring-boot:run -Dspring-boot.run.profiles=local
