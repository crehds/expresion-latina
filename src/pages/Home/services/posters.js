async function getPosters() {
  const response = await fetch('/posters');
  const posters = await response.json();

  return posters.data;
}

export default getPosters;
