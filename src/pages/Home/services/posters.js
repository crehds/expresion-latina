const server = process.env.NODE_ENV === 'development' ? '' : 'https://expensable-api-production.up.railway.app';

async function getPosters() {
  const response = await fetch(`${server}/posters`);
  const posters = await response.json();

  return posters.data;
}

export default getPosters;
