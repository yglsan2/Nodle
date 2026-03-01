package fr.nodle.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Recherche de GIFs auprès de plusieurs fournisseurs configurables (Giphy, Tenor, etc.).
 * Aucun partenariat exclusif : une fois les clés API configurées, tous les fournisseurs sont utilisables.
 */
@RestController
@RequestMapping("/api/gifs")
public class GifSearchController {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${nodle.gifs.giphy-api-key:}")
    private String giphyApiKey;

    @Value("${nodle.gifs.tenor-api-key:}")
    private String tenorApiKey;

    /** Liste des fournisseurs actifs (ceux pour lesquels une clé est configurée). */
    @GetMapping("/providers")
    public ResponseEntity<List<String>> providers() {
        List<String> list = new ArrayList<>();
        if (giphyApiKey != null && !giphyApiKey.isBlank()) list.add("giphy");
        if (tenorApiKey != null && !tenorApiKey.isBlank()) list.add("tenor");
        return ResponseEntity.ok(list);
    }

    /** Recherche agrégée sur tous les fournisseurs configurés. Format unifié : url, title, provider. */
    @GetMapping("/search")
    public ResponseEntity<List<Map<String, String>>> search(
            @RequestParam("q") String query,
            @RequestParam(value = "limit", defaultValue = "24") int limit
    ) {
        if (query == null || query.isBlank()) {
            return ResponseEntity.ok(List.of());
        }
        int perProvider = Math.min(limit, 20);
        List<Map<String, String>> results = new ArrayList<>();

        if (giphyApiKey != null && !giphyApiKey.isBlank()) {
            try {
                results.addAll(searchGiphy(query, perProvider));
            } catch (Exception ignored) {}
        }
        if (tenorApiKey != null && !tenorApiKey.isBlank()) {
            try {
                results.addAll(searchTenor(query, perProvider));
            } catch (Exception ignored) {}
        }

        return ResponseEntity.ok(results);
    }

    private List<Map<String, String>> searchGiphy(String q, int limit) throws Exception {
        String url = "https://api.giphy.com/v1/gifs/search?api_key=" + giphyApiKey
                + "&q=" + URLEncoder.encode(q, StandardCharsets.UTF_8)
                + "&limit=" + limit + "&rating=g";
        JsonNode root = fetchJson(url);
        JsonNode data = root != null ? root.get("data") : null;
        List<Map<String, String>> out = new ArrayList<>();
        if (data == null || !data.isArray()) return out;
        for (JsonNode item : data) {
            String title = item.has("title") ? item.get("title").asText("") : "";
            JsonNode images = item.get("images");
            if (images == null) continue;
            String imageUrl = null;
            if (images.has("fixed_height_small")) {
                imageUrl = text(images.get("fixed_height_small"), "url");
            }
            if (imageUrl == null && images.has("original")) {
                imageUrl = text(images.get("original"), "url");
            }
            if (imageUrl != null && !imageUrl.isBlank()) {
                out.add(Map.of(
                        "url", imageUrl,
                        "title", title != null ? title : "",
                        "provider", "giphy",
                        "id", item.has("id") ? item.get("id").asText() : imageUrl
                ));
            }
        }
        return out;
    }

    private List<Map<String, String>> searchTenor(String q, int limit) throws Exception {
        String url = "https://tenor.googleapis.com/v2/search?q=" + URLEncoder.encode(q, StandardCharsets.UTF_8)
                + "&key=" + tenorApiKey
                + "&client_key=nodle"
                + "&limit=" + limit
                + "&contentfilter=high";
        JsonNode root = fetchJson(url);
        JsonNode results = root != null ? root.get("results") : null;
        List<Map<String, String>> out = new ArrayList<>();
        if (results == null || !results.isArray()) return out;
        for (JsonNode item : results) {
            JsonNode media = item.get("media_formats");
            if (media == null) continue;
            String imageUrl = text(media.get("gif"), "url");
            if (imageUrl == null) imageUrl = text(media.get("tinygif"), "url");
            if (imageUrl == null) continue;
            String title = item.has("content_description") ? item.get("content_description").asText("") : "";
            out.add(Map.of(
                    "url", imageUrl,
                    "title", title != null ? title : "",
                    "provider", "tenor",
                    "id", item.has("id") ? item.get("id").asText() : imageUrl
            ));
        }
        return out;
    }

    private static String text(JsonNode n, String field) {
        if (n == null || !n.has(field)) return null;
        JsonNode v = n.get(field);
        return v != null && v.isTextual() ? v.asText() : null;
    }

    private JsonNode fetchJson(String urlString) throws Exception {
        URI uri = URI.create(urlString);
        java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder().build();
        java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder(uri).GET().build();
        java.net.http.HttpResponse<String> response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() != 200) return null;
        return objectMapper.readTree(response.body());
    }
}
