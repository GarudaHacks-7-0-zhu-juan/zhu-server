-- CreateTable
CREATE TABLE "EarthquakeEvent" (
    "id" TEXT NOT NULL,
    "bmkgDateTime" TIMESTAMP(3) NOT NULL,
    "magnitude" DOUBLE PRECISION NOT NULL,
    "depthKm" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "region" TEXT NOT NULL,
    "potential" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarthquakeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EarthquakeEvent_bmkgDateTime_key" ON "EarthquakeEvent"("bmkgDateTime");
