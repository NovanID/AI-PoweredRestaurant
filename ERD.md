erDiagram
    TENANT {
        uuid id PK
        string slug UK
        string name
        string status
        string timezone
        string currency
        string phone
        string address
        json settings
        datetime created_at
        datetime updated_at
    }

    USER {
        uuid id PK
        string email UK
        string password_hash
        string name
        string status
        datetime created_at
        datetime updated_at
    }

    TENANT_MEMBERSHIP {
        uuid tenant_id PK,FK
        uuid user_id PK,FK
        string role
        datetime created_at
    }

    CUSTOMER {
        uuid id PK
        uuid tenant_id FK
        string name
        string phone
        string normalized_phone
        datetime created_at
        datetime updated_at
    }

    DINING_TABLE {
        uuid id PK
        uuid tenant_id FK
        string number
        int capacity
        string area
        string status
        datetime created_at
        datetime updated_at
    }

    MENU_CATEGORY {
        uuid id PK
        uuid tenant_id FK
        string name
        int sort_order
        boolean is_active
    }

    MENU_ITEM {
        uuid id PK
        uuid tenant_id FK
        uuid category_id FK
        string name
        string description
        decimal price
        boolean is_available
        boolean is_popular
        datetime created_at
        datetime updated_at
    }

    RESERVATION {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        uuid table_id FK
        string code
        string customer_name_snapshot
        string customer_phone_snapshot
        datetime starts_at
        datetime ends_at
        int guest_count
        string status
        string notes
        datetime created_at
        datetime updated_at
    }

    ORDER {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        uuid reservation_id FK
        uuid table_id FK
        string code
        string channel
        string status
        decimal subtotal
        decimal tax
        decimal discount
        decimal total
        datetime created_at
        datetime updated_at
    }

    ORDER_ITEM {
        uuid id PK
        uuid tenant_id FK
        uuid order_id FK
        uuid menu_item_id FK
        string item_name_snapshot
        decimal unit_price_snapshot
        int quantity
        string notes
        decimal line_total
    }

    PAYMENT {
        uuid id PK
        uuid tenant_id FK
        uuid order_id FK
        uuid reservation_id FK
        string provider
        string external_id
        string method
        string status
        decimal amount
        datetime paid_at
        datetime created_at
        datetime updated_at
    }

    PAYMENT_EVENT {
        uuid id PK
        uuid tenant_id FK
        uuid payment_id FK
        string external_event_id
        string status
        json payload
        datetime received_at
    }

    AUDIT_EVENT {
        uuid id PK
        uuid tenant_id FK
        uuid actor_user_id FK
        string action
        string entity_type
        uuid entity_id
        json before_data
        json after_data
        datetime created_at
    }

    TENANT ||--o{ TENANT_MEMBERSHIP : has
    USER ||--o{ TENANT_MEMBERSHIP : joins

    TENANT ||--o{ CUSTOMER : owns
    TENANT ||--o{ DINING_TABLE : owns
    TENANT ||--o{ MENU_CATEGORY : owns
    TENANT ||--o{ MENU_ITEM : owns
    TENANT ||--o{ RESERVATION : owns
    TENANT ||--o{ ORDER : owns
    TENANT ||--o{ PAYMENT : owns
    TENANT ||--o{ AUDIT_EVENT : records

    MENU_CATEGORY ||--o{ MENU_ITEM : groups
    CUSTOMER o|--o{ RESERVATION : makes
    DINING_TABLE o|--o{ RESERVATION : assigned_to

    CUSTOMER o|--o{ ORDER : places
    RESERVATION o|--o{ ORDER : generates
    DINING_TABLE o|--o{ ORDER : served_at
    ORDER ||--|{ ORDER_ITEM : contains
    MENU_ITEM o|--o{ ORDER_ITEM : referenced_by

    ORDER o|--o{ PAYMENT : paid_by
    RESERVATION o|--o{ PAYMENT : deposit_paid_by
    PAYMENT ||--o{ PAYMENT_EVENT : receives
    USER o|--o{ AUDIT_EVENT : performs






disclaimer = ini hanya gambaran saja pastinya ini harus diuji dulu