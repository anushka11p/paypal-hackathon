from __future__ import annotations

# Closed vocabularies. The compiler may only emit these, and the engine
# only compares against these, so a mandate can't silently drift into
# categories the catalog doesn't use.
CATEGORIES = ("pet_food", "pet_treats", "pet_supplements", "pet_toys", "pet_accessories")
ALLERGENS = ("chicken", "beef", "lamb", "fish", "dairy", "egg", "wheat", "soy", "corn", "peanut")

# Upper bound on any single mandate's hold, whatever the user types.
BUDGET_CEILING_CENTS = 50000
