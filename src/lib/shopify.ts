const SHOPIFY_API_VERSION = '2024-01';

export async function fetchShopify(shop: string, accessToken: string, query: string, variables = {}) {
  const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanShop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  
  let response: Response | null = null;
  const maxRetries = 3;
  let backoff = 1000; // Start with 1s

  for (let i = 0; i <= maxRetries; i++) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
        cache: 'no-store',
      });

      if (response.status === 429) {
        // Rate Limited
        if (i === maxRetries) break; // Give up
        
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : backoff;
        
        console.warn(` Shopify 429 Rate Limit. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitTime));
        
        // Exponential backoff if no header provided
        if (!retryAfter) backoff *= 2; 
        continue;
      }

      // If generic 5xx error, maybe we should also retry? For now, let's stick to 429 as strictly planned.
      break;

    } catch (err) {
      if (i === maxRetries) throw err;
      console.warn(` Network error fetching Shopify. Retrying... (${i + 1}/${maxRetries})`);
      await new Promise(r => setTimeout(r, backoff));
      backoff *= 2;
    }
  }

  if (!response) {
     throw new Error('Shopify API request failed after retries');
  }

  if (!response.ok) {
    console.error(` Failed to fetch: ${url}`);
    throw new Error(`Shopify API Error: ${response.statusText} (${response.status})`);
  }

  const json = await response.json();
  
  // GraphQL can return data AND errors (partial success). 
  // If we have data, we return it but log the errors.
  if (json.errors) {
    console.warn(` Shopify GraphQL Warning:`, JSON.stringify(json.errors, null, 2));
    if (!json.data) {
        throw new Error(`Shopify GraphQL Error: ${JSON.stringify(json.errors)}`);
    }
  }

  return json.data;
}

export const GET_CUSTOMERS_QUERY = `
  query getCustomers($first: Int!, $cursor: String, $query: String) {
    customers(first: $first, after: $cursor, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          firstName
          lastName
          email
          amountSpent {
            amount
          }
          numberOfOrders
          createdAt
        }
      }
    }
  }
`;

export const GET_PRODUCTS_QUERY = `
  query getProducts($first: Int!, $cursor: String, $query: String) {
    products(first: $first, after: $cursor, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          bodyHtml
          vendor
          productType
          status
          createdAt
        }
      }
    }
  }
`;

export const GET_ORDERS_QUERY = `
  query getOrders($first: Int!, $cursor: String, $query: String) {
    orders(first: $first, after: $cursor, query: $query, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          displayFinancialStatus
          displayFulfillmentStatus
          createdAt
          customer {
            id
          }
          lineItems(first: 50) {
            edges {
              node {
                title
                quantity
                originalTotalSet {
                  shopMoney {
                    amount
                  }
                }
                product {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;
