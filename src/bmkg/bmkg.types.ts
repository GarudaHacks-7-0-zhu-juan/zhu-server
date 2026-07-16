export interface BmkgEarthquake {
  dateTime: Date;
  magnitude: number;
  depthKm: number;
  latitude: number;
  longitude: number;
  region: string;
  potential: string;
}

export interface BmkgApiResponse {
  Infogempa: {
    gempa: BmkgApiEarthquake[];
  };
}

export interface BmkgApiEarthquake {
  Tanggal: string;
  Jam: string;
  DateTime: string;
  Coordinates: string;
  Lintang: string;
  Bujur: string;
  Magnitude: string;
  Kedalaman: string;
  Wilayah: string;
  Potensi: string;
}
