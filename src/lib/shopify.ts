const SHOPIFY_API_VERSION = '2024-01';

export async function fetchShopify(shop: string, accessToken: string, query: string, variables = {}) {
  const cleanShop = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${cleanShop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    console.error(`❌ Failed to fetch: ${url}`);
    throw new Error(`Shopify API Error: ${response.statusText} (${response.status})`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`Shopify GraphQL Error: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

export const GET_CUSTOMERS_QUERY = `
  query getCustomers($first: Int!, $cursor: String) {
    customers(first: $first, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
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
  query getProducts($first: Int!, $cursor: String) {
    products(first: $first, after: $cursor) {
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
  query getOrders($first: Int!, $cursor: String) {
    orders(first: $first, after: $cursor) {
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
        }
      }
    }
  }
`;
