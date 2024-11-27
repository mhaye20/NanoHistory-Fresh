export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
};

export const convertDistance = (meters, unit = 'km') => {
  if (unit === 'mi') {
    return (meters / 1609.344).toFixed(1) + ' mi';
  }
  return (meters / 1000).toFixed(1) + ' km';
};
