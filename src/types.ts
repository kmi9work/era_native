export interface Player {
  id: number;
  name: string;
  identificator: string;
  player_type?: string;
  family?: string;
  jobs: string[];
}

export interface Guild {
  id: number;
  name: string;
}

export interface PlantPlace {
  id: number;
  name: string;
  region_id: number;
  region_name: string;
  region_country_id?: number | null;
  allowed?: boolean;
}

export interface TechnologyRequirement {
  id: number;
  name: string;
  open: boolean;
}

export interface PlantLevel {
  id: number;
  level: number;
  plant_type_id: number;
  price: Record<string, number>;
  deposit: string;
}

export interface PlantType {
  id: number;
  name: string;
  plant_category_id: number;
  plant_category: string;
  fossil_type_id?: number;
}

export interface AvailablePlaceInfo {
  plant_type_id: number;
  plant_type_name: string;
  plant_category: string;
  plant_category_id: number;
  available_places: PlantPlace[];
  technology_requirements?: TechnologyRequirement[];
}

export interface Plant {
  id: number;
  plant_level_id: number;
  plant_place_id: number;
  economic_subject_id: number;
  economic_subject_type: string;
}

export interface Country {
  id: number;
  name: string;
  short_name?: string;
  flag_image_name?: string;
  relations?: number;
  params?: {
    embargo?: number;
  };
}

export interface Resource {
  identificator: string;
  name: string;
  count?: number;
  country_id?: number;
  country?: { id: number };
  buy_price?: number;
  sell_price?: number;
}

export interface CaravanRequest {
  country_id: number | null; // null для Artel (рынок без страны)
  guild_id: number;
  incoming: Array<{
    identificator: string;
    name: string;
    count: number;
    current_sell_price?: number;
  }>;
  outcoming: Array<{
    identificator: string;
    name: string;
    count: number;
    current_buy_price?: number;
  }>;
  purchase_cost: number;
  sale_income: number;
  via_vyatka: boolean;
  is_protected: boolean;
}
