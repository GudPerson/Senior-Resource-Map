import http from 'http';

http.get('http://localhost:4000/api/favorites', {
  headers: {
    'Accept': 'application/json',
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      console.log('Status:', res.statusCode);
      if (res.statusCode >= 400) {
        console.log('Error:', data);
        return;
      }
      const json = JSON.parse(data);
      console.log('Total items:', json.length);
      json.forEach(item => {
        if (item.resourceType === 'soft') {
          console.log(`Soft Asset ${item.resourceId}: ${item.name} | hostIds: ${JSON.stringify(item.hostHardAssetIds)}`);
        }
      });
    } catch(e) { console.log(e); }
  });
});
