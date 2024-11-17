-- Enable PostGIS if not already enabled
create extension if not exists postgis;

-- Ensure locations table exists with proper structure
create table if not exists locations (
    id bigint primary key generated always as identity,
    title text not null,
    description text,
    latitude double precision not null,
    longitude double precision not null,
    image_url text,
    rating numeric(3,2),
    visit_count integer default 0,
    historical_period text,
    category text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    location geometry(Point, 4326)
);

-- Insert test locations (using coordinates around a central point for testing)
insert into locations (
    title,
    description,
    latitude,
    longitude,
    image_url,
    rating,
    historical_period,
    category
) values 
(
    'Historic Downtown Square',
    'A beautiful town square dating back to the 1800s, featuring original architecture and historical landmarks.',
    37.7749,
    -122.4194,
    'https://picsum.photos/800/600',
    4.5,
    '19th Century',
    'Architecture'
),
(
    'Old City Hall',
    'Magnificent example of Victorian architecture, serving as the city''s government center since 1875.',
    37.7799,
    -122.4159,
    'https://picsum.photos/800/600',
    4.8,
    '19th Century',
    'Government'
),
(
    'Maritime Museum',
    'Former shipyard converted into a museum showcasing the city''s rich maritime history.',
    37.7829,
    -122.4132,
    'https://picsum.photos/800/600',
    4.2,
    '20th Century',
    'Maritime'
);

-- Update location geometry column for all entries
update locations 
set location = st_setsrid(st_makepoint(longitude, latitude), 4326)
where location is null;

-- Create spatial index if it doesn't exist
create index if not exists locations_geometry_idx on locations using gist(location);

-- Verify the function exists
create or replace function calculate_distances(lat float, lng float, radius_meters float)
returns table (
    id bigint,
    distance float
) 
language plpgsql
as $$
begin
    return query
    select 
        locations.id,
        st_distance(
            geography(st_makepoint(lng, lat)),
            geography(locations.location)
        ) as distance
    from locations
    where st_dwithin(
        geography(st_makepoint(lng, lat)),
        geography(locations.location),
        radius_meters
    );
end;
$$;
