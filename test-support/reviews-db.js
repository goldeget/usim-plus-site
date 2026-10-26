/** In-memory D1 subset for reviews tables (shared by tests and local seed). */
export function extendReviewsDb(db, bucket) {
  const reviews = new Map();
  const origPrepare = db.prepare.bind(db);

  function executor(sql, values = []) {
    const bound = origPrepare(sql).bind(...values);
    return {
      async first() {
        if (/FROM review_stats WHERE id = 'global'/i.test(sql)) {
          return reviews.get("__stats__") || null;
        }
        if (/FROM reviews WHERE id = \?/i.test(sql)) {
          return reviews.get(values[0]) || null;
        }
        if (/SELECT COUNT\(\*\) AS c FROM reviews/i.test(sql)) {
          let c = 0;
          for (const r of reviews.values()) if (r?.status === "published") c += 1;
          return { c };
        }
        if (/FROM reviews WHERE status = 'published'/i.test(sql) && /SUM\(rating\)/i.test(sql)) {
          let total = 0;
          let rating_sum = 0;
          const hist = { r1: 0, r2: 0, r3: 0, r4: 0, r5: 0 };
          for (const r of reviews.values()) {
            if (!r || r.status !== "published") continue;
            total += 1;
            rating_sum += r.rating;
            hist[`r${r.rating}`] += 1;
          }
          return { total, rating_sum, ...hist };
        }
        return bound.first?.() ?? null;
      },
      async all() {
        if (/FROM reviews/i.test(sql)) {
          // review_stats rows live in the same map under "__stats__" (id "global");
          // a real D1 keeps them in a separate table, so never list them here.
          let rows = [...reviews.values()].filter(r => r && r.id && r.id !== "global");
          if (/status = 'published'/i.test(sql)) rows = rows.filter(r => r.status === "published");
          if (/featured = 1/i.test(sql)) rows = rows.filter(r => r.featured === 1);
          rows.sort((a, b) => {
            const pb = b.published_at.localeCompare(a.published_at);
            return pb !== 0 ? pb : (a.id < b.id ? 1 : -1);
          });
          const limit = values.at(-1);
          if (typeof limit === "number") rows = rows.slice(0, limit);
          return { results: rows };
        }
        return bound.all?.() ?? { results: [] };
      },
      async run() {
        if (/INSERT INTO reviews/i.test(sql)) {
          const [
            id, published_at, rating, snippet, snippet_sha256, body_sha256, body_norm_sha256,
            body_r2_key, body_byte_length, display_name, tags_json, source, source_row_id,
            status, featured, sort_boost, created_at, updated_at
          ] = values;
          for (const r of reviews.values()) {
            if (!r?.id) continue;
            if (r.body_sha256 === body_sha256 || r.body_norm_sha256 === body_norm_sha256 || r.snippet_sha256 === snippet_sha256) {
              throw new Error("UNIQUE constraint failed: reviews.body_sha256");
            }
          }
          reviews.set(id, {
            id, published_at, rating, snippet, snippet_sha256, body_sha256, body_norm_sha256,
            body_r2_key, body_byte_length, display_name, tags_json, source, source_row_id,
            status, featured, sort_boost, created_at, updated_at
          });
          return { meta: { changes: 1 } };
        }
        if (/INSERT INTO review_stats/i.test(sql) || (/ON CONFLICT\(id\) DO UPDATE SET/i.test(sql) && /review_stats/i.test(sql))) {
          reviews.set("__stats__", {
            id: "global",
            total_published: values[0],
            avg_rating: values[1],
            histogram_json: values[2],
            rating_sum: values[3],
            updated_at: values[4]
          });
          return { meta: { changes: 1 } };
        }
        return bound.run?.() ?? { meta: { changes: 0 } };
      }
    };
  }

  db.prepare = sql => ({
    bind(...values) {
      return executor(sql, values);
    },
    first() {
      return executor(sql, []).first();
    },
    all() {
      return executor(sql, []).all();
    },
    run() {
      return executor(sql, []).run();
    }
  });
  void bucket;
}
