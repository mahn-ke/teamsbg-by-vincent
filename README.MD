# Immich Random Album Image Server

A minimal Node.js Express server that fetches a random image from an Immich album, smart-crops it to the requested aspect ratio, and serves it at [teamsbg.by.vincent.mahn.ke](https://teamsbg.by.vincent.mahn.ke).

Uses code of https://github.com/mahn-ke/wallpapers-by-vincent/ with a different album and subdomain.

New images are only shown on workdays; weekends repeat Friday's image (`WORKDAYS_ONLY_SINCE`). The weekend images that went unseen between `WEEKEND_CATCHUP_FROM` and `WORKDAYS_ONLY_SINCE` are replayed first, one per workday. See the wallpapers-by-vincent README for details.
