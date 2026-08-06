CREATE TABLE "ontology_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_node_id" uuid NOT NULL,
	"to_node_id" uuid NOT NULL,
	"predicate" text NOT NULL,
	"confidence" "confidence" DEFAULT 'possible' NOT NULL,
	"sources" jsonb,
	"evidence_count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ontology_edges_uq" UNIQUE("from_node_id","to_node_id","predicate")
);
--> statement-breakpoint
CREATE TABLE "ontology_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "entity_type" NOT NULL,
	"value" text NOT NULL,
	"mentions" integer DEFAULT 1 NOT NULL,
	"sources" jsonb,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ontology_nodes_type_value_uq" UNIQUE("type","value")
);
--> statement-breakpoint
ALTER TABLE "ontology_edges" ADD CONSTRAINT "ontology_edges_from_node_id_ontology_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."ontology_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ontology_edges" ADD CONSTRAINT "ontology_edges_to_node_id_ontology_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."ontology_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ontology_edges_from_idx" ON "ontology_edges" USING btree ("from_node_id");--> statement-breakpoint
CREATE INDEX "ontology_edges_to_idx" ON "ontology_edges" USING btree ("to_node_id");