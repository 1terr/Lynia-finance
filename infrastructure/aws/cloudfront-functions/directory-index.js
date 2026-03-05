function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Replace UUID path segments with '_' for Next.js dynamic routes
  // Matches: /products/{uuid}/ → /products/_/
  // Also handles nested: /customers/{uuid}/edit/ → /customers/_/edit/
  uri = uri.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$)/gi, '/_$1');

  // Standard directory index rewrite
  if (uri.endsWith('/')) {
    uri += 'index.html';
  } else if (uri.indexOf('.') === -1) {
    uri += '/index.html';
  }

  request.uri = uri;
  return request;
}
