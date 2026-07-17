import { Injectable, OnModuleInit } from '@nestjs/common';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RiskLevel } from '@prisma/client';

type RiskProperties = {
  kecamatan: string;
  risk_score: number;
  risk_level: RiskLevel;
  risk_policy_version: string;
};

type RiskFeature = {
  type: 'Feature';
  properties: RiskProperties;
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
  bbox: [number, number, number, number];
};

export type AreaRiskAssessment = {
  riskLevel: RiskLevel;
  district: string | null;
  riskScore: number | null;
  riskPolicyVersion: string | null;
  outsideCoverage: boolean;
};

@Injectable()
export class RiskGeoService implements OnModuleInit {
  private features: RiskFeature[] = [];

  onModuleInit(): void {
    const artifact = JSON.parse(
      readFileSync(join(__dirname, 'data', 'kecamatan_boundaries.geojson'), 'utf8'),
    ) as { type?: string; features?: unknown[] };
    if (artifact.type !== 'FeatureCollection' || artifact.features?.length !== 44) {
      throw new Error('Risk map must contain exactly 44 GeoJSON features.');
    }

    this.features = artifact.features.map((feature) => this.validateFeature(feature));
    if (new Set(this.features.map(({ properties }) => properties.kecamatan)).size !== 44) {
      throw new Error('Risk map contains duplicate kecamatan.');
    }
  }

  evaluate(latitude: number, longitude: number): AreaRiskAssessment {
    for (const feature of this.features) {
      const [minLongitude, minLatitude, maxLongitude, maxLatitude] = feature.bbox;
      if (
        longitude < minLongitude || longitude > maxLongitude ||
        latitude < minLatitude || latitude > maxLatitude ||
        !booleanPointInPolygon([longitude, latitude], feature.geometry, { ignoreBoundary: false })
      ) continue;
      return {
        riskLevel: feature.properties.risk_level,
        district: feature.properties.kecamatan,
        riskScore: feature.properties.risk_score,
        riskPolicyVersion: feature.properties.risk_policy_version,
        outsideCoverage: false,
      };
    }
    return { riskLevel: RiskLevel.NONE, district: null, riskScore: null, riskPolicyVersion: null, outsideCoverage: true };
  }

  private validateFeature(value: unknown): RiskFeature {
    const feature = value as { type?: string; properties?: Partial<RiskProperties>; geometry?: RiskFeature['geometry'] };
    const { properties, geometry } = feature;
    const score = properties?.risk_score;
    if (
      feature.type !== 'Feature' || geometry?.type !== 'MultiPolygon' ||
      !properties?.kecamatan || typeof score !== 'number' || !Number.isFinite(score) ||
      score < 0 || score > 1 ||
      !Object.values(RiskLevel).includes(properties.risk_level as RiskLevel) ||
      properties.risk_policy_version !== 'jakarta-kecamatan-v2'
    ) throw new Error('Risk map feature is invalid.');
    const points = geometry.coordinates.flat(2);
    if (!points.length || points.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude))) {
      throw new Error('Risk map geometry is invalid.');
    }
    const longitudes = points.map(([longitude]) => longitude);
    const latitudes = points.map(([, latitude]) => latitude);
    return {
      type: 'Feature', properties: properties as RiskProperties, geometry,
      bbox: [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
    };
  }
}
