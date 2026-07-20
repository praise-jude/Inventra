import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/site-url";

// Hand-written OpenAPI 3.0 spec — kept in sync manually with app/api/v1/**
// by hand (no schema-generation tooling in this codebase); update this
// alongside any route change under app/api/v1/.
export async function GET() {
  const base = await siteUrl();
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Inventra Public API",
      version: "1.0.0",
      description:
        "Read and write your organization's inventory, sales, and customer data. Authenticate with an API key created in Settings > API Keys, sent as `Authorization: Bearer <key>`. Rate limit: 60 requests/minute per key.",
    },
    servers: [{ url: `${base}/api/v1` }],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: "http", scheme: "bearer", bearerFormat: "inv_live_..." },
      },
      schemas: {
        Product: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            sku: { type: "string" },
            barcode: { type: "string", nullable: true },
            name: { type: "string" },
            description: { type: "string", nullable: true },
            brand: { type: "string", nullable: true },
            unit: { type: "string" },
            costPrice: { type: "number" },
            sellPrice: { type: "number" },
            reorderLevel: { type: "integer" },
            qtyOnHand: { type: "integer" },
            status: { type: "string", enum: ["in_stock", "low_stock", "out_of_stock"] },
            isActive: { type: "boolean" },
            expiryDate: { type: "string", format: "date", nullable: true },
            categoryId: { type: "string", format: "uuid", nullable: true },
            supplierId: { type: "string", format: "uuid", nullable: true },
            warehouseId: { type: "string", format: "uuid", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        ProductCreate: {
          type: "object",
          required: ["name", "sku"],
          properties: {
            name: { type: "string" },
            sku: { type: "string" },
            description: { type: "string" },
            brand: { type: "string" },
            barcode: { type: "string" },
            unit: { type: "string", default: "each" },
            costPrice: { type: "number", minimum: 0 },
            sellPrice: { type: "number", minimum: 0 },
            reorderLevel: { type: "integer", minimum: 0 },
            categoryId: { type: "string", format: "uuid" },
            supplierId: { type: "string", format: "uuid" },
            warehouseId: { type: "string", format: "uuid" },
          },
        },
        Sale: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            customerId: { type: "string", format: "uuid", nullable: true },
            walkInName: { type: "string", nullable: true },
            warehouseId: { type: "string", format: "uuid", nullable: true },
            subtotal: { type: "number" },
            discountAmount: { type: "number" },
            taxAmount: { type: "number" },
            total: { type: "number" },
            notes: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Customer: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            phone: { type: "string", nullable: true },
            email: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
        Pagination: {
          type: "object",
          properties: {
            limit: { type: "integer" },
            offset: { type: "integer" },
            total: { type: "integer" },
          },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/products": {
        get: {
          summary: "List products",
          security: [{ ApiKeyAuth: ["products:read"] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": {
              description: "A page of products",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                      pagination: { $ref: "#/components/schemas/Pagination" },
                    },
                  },
                },
              },
            },
            "401": { description: "Missing or invalid API key", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "Key lacks the products:read scope", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "429": { description: "Rate limit exceeded", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          summary: "Create a product",
          security: [{ ApiKeyAuth: ["products:write"] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ProductCreate" } } } },
          responses: {
            "201": { description: "Created", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Product" } } } } } },
            "409": { description: "SKU or barcode already exists", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/products/{id}": {
        get: {
          summary: "Get a product",
          security: [{ ApiKeyAuth: ["products:read"] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "The product", content: { "application/json": { schema: { type: "object", properties: { data: { $ref: "#/components/schemas/Product" } } } } } },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/sales": {
        get: {
          summary: "List sales",
          security: [{ ApiKeyAuth: ["sales:read"] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
            { name: "dateFrom", in: "query", schema: { type: "string", format: "date" } },
            { name: "dateTo", in: "query", schema: { type: "string", format: "date" } },
          ],
          responses: {
            "200": {
              description: "A page of sales",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { data: { type: "array", items: { $ref: "#/components/schemas/Sale" } }, pagination: { $ref: "#/components/schemas/Pagination" } },
                  },
                },
              },
            },
          },
        },
      },
      "/sales/{id}": {
        get: {
          summary: "Get a sale, with line items and payments",
          security: [{ ApiKeyAuth: ["sales:read"] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "The sale" },
            "404": { description: "Not found", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/customers": {
        get: {
          summary: "List customers",
          security: [{ ApiKeyAuth: ["customers:read"] }],
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 25, maximum: 100 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            "200": {
              description: "A page of customers",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { data: { type: "array", items: { $ref: "#/components/schemas/Customer" } }, pagination: { $ref: "#/components/schemas/Pagination" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
