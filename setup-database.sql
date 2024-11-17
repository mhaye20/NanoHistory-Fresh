-- Update existing locations to be near Brooklyn
update locations
set 
    latitude = 40.68283074961536,
    longitude = -73.936985894628,
    location = st_setsrid(st_makepoint(-73.936985894628, 40.68283074961536), 4326)
where id = 1;

update locations
set 
    latitude = 40.68483074961536,
    longitude = -73.934985894628,
    location = st_setsrid(st_makepoint(-73.934985894628, 40.68483074961536), 4326)
where id = 2;

update locations
set 
    latitude = 40.68083074961536,
    longitude = -73.938985894628,
    location = st_setsrid(st_makepoint(-73.938985894628, 40.68083074961536), 4326)
where id = 3;

update locations
set 
    latitude = 40.68683074961536,
    longitude = -73.932985894628,
    location = st_setsrid(st_makepoint(-73.932985894628, 40.68683074961536), 4326)
where id = 4;
