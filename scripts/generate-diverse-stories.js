const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY
);

// List of US states
const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California',
    'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia',
    'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland',
    'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri',
    'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
    'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
    'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

// Type-specific search queries
const typeQueries = {
    music: [
        'historic concert hall',
        'historic opera house',
        'historic music venue',
        'historic theater',
        'historic jazz club',
        'historic music school',
        'historic recording studio'
    ],
    art: [
        'art museum',
        'art gallery',
        'historic art center',
        'sculpture garden',
        'historic art institute',
        'historic art school',
        'artist studio'
    ],
    fashion: [
        'historic fashion district',
        'historic textile mill',
        'fashion museum',
        'historic clothing factory',
        'historic garment district',
        'historic design school',
        'costume museum'
    ],
    politics: [
        'state capitol',
        'historic courthouse',
        'government building',
        'historic city hall',
        'historic political site',
        'historic legislative building',
        'diplomatic building'
    ],
    civilRights: [
        'civil rights memorial',
        'civil rights museum',
        'historic protest site',
        'freedom trail',
        'civil rights landmark',
        'historic civil rights site',
        'social justice landmark'
