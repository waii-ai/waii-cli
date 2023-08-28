WITH total_population AS (
    SELECT
        c.code,
        SUM(ci.population) AS total_population
    FROM tweakit_playground.world.city AS ci
    INNER JOIN tweakit_playground.world.country AS c
        ON ci.countrycode = c.code
    GROUP BY
        c.code
),

official_language_population AS (
    SELECT
        cl.countrycode,
        SUM(ci.population * cl.percentage / 100) AS official_language_population
    FROM tweakit_playground.world.city AS ci
    INNER JOIN tweakit_playground.world.countrylanguage AS cl
        ON ci.countrycode = cl.countrycode
    WHERE
        cl.isofficial = 'T'
    GROUP BY
        cl.countrycode
)

SELECT
    tp.code,
    c.name,
    (
        olp.official_language_population / NULLIF(tp.total_population, 0)
    ) * 100 AS official_language_percentage
FROM total_population AS tp
INNER JOIN official_language_population AS olp
    ON tp.code = olp.countrycode
INNER JOIN tweakit_playground.world.country AS c
    ON tp.code = c.code
EOF
