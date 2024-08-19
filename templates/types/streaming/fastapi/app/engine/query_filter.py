from llama_index.core.vector_stores.types import MetadataFilter, MetadataFilters


def generate_filters(doc_ids):
    """
    Generate public/private document filters based on the doc_ids and the vector store.
    """
    public_doc_filter = MetadataFilter(
        key="private",
        value="true",
        operator="!=",  # type: ignore
    )
    selected_doc_filter = MetadataFilter(
        key="doc_id",
        value=doc_ids,
        operator="in",  # type: ignore
    )
    if len(doc_ids) > 0:
        # If doc_ids are provided, we will select both public and selected documents
        filters = MetadataFilters(
            filters=[
                public_doc_filter,
                selected_doc_filter,
            ],
            condition="or",  # type: ignore
        )
    else:
        filters = MetadataFilters(
            filters=[
                public_doc_filter,
            ]
        )

    return filters
