package fr.nodle.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

/**
 * Upload et liste des GIFs.
 * Accepte tous les formats "GIF-like" : GIF, WebP animé, APNG, MP4, WebM.
 * Compatible avec n'importe quel éditeur de GIFs.
 */
@RestController
@RequestMapping("/api/gifs")
public class GifController {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("gif", "webp", "png", "apng", "mp4", "webm");
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/gif", "image/webp", "image/png", "image/apng",
            "video/mp4", "video/webm"
    );

    @Value("${nodle.gifs.storage-path:./data/gifs}")
    private String storagePath;

    private Path basePath;

    @PostConstruct
    public void init() throws IOException {
        basePath = Path.of(storagePath).toAbsolutePath();
        Files.createDirectories(basePath);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<GifResponse> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "category", defaultValue = "custom") String category
    ) {
        if (file.isEmpty()) return ResponseEntity.badRequest().build();

        String originalName = file.getOriginalFilename();
        String ext = originalName != null ? getExtension(originalName).toLowerCase(Locale.ROOT) : "";
        String contentType = file.getContentType();

        if (!ALLOWED_EXTENSIONS.contains(ext) && !isAllowedContentType(contentType)) {
            return ResponseEntity.badRequest().build();
        }

        String safeName = UUID.randomUUID().toString() + "." + (ALLOWED_EXTENSIONS.contains(ext) ? ext : "bin");
        Path dir = basePath.resolve(sanitize(category));
        try {
            Files.createDirectories(dir);
            Path target = dir.resolve(safeName);
            file.transferTo(target.toFile());
            String url = "/api/gifs/file/" + category + "/" + safeName;
            return ResponseEntity.ok(new GifResponse(url, category, originalName, contentType));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/file/{category}/{filename}")
    public ResponseEntity<org.springframework.core.io.Resource> serve(
            @PathVariable String category,
            @PathVariable String filename
    ) {
        Path file = basePath.resolve(sanitize(category)).resolve(sanitizeFilename(filename));
        if (!Files.isRegularFile(file)) return ResponseEntity.notFound().build();
        try {
            var resource = new org.springframework.core.io.InputStreamResource(Files.newInputStream(file));
            String contentType = Files.probeContentType(file);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType != null ? contentType : "application/octet-stream"))
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryInfo>> categories() {
        List<CategoryInfo> list = new ArrayList<>();
        try (var stream = Files.list(basePath)) {
            stream.filter(Files::isDirectory).forEach(dir -> {
                try {
                    long count = Files.list(dir).count();
                    list.add(new CategoryInfo(dir.getFileName().toString(), count));
                } catch (IOException ignored) {}
            });
        } catch (IOException ignored) {}
        return ResponseEntity.ok(list);
    }

    @GetMapping("/list")
    public ResponseEntity<List<GifInfo>> list(@RequestParam(value = "category", required = false) String category) {
        Path dir = category != null && !category.isBlank() ? basePath.resolve(sanitize(category)) : basePath;
        List<GifInfo> list = new ArrayList<>();
        try {
            if (Files.isDirectory(dir)) {
                listGifs(dir, basePath.relativize(dir).toString(), list);
            }
            if (category == null || category.isBlank()) {
                try (var stream = Files.list(basePath)) {
                    stream.filter(Files::isDirectory).forEach(d -> {
                        try {
                            listGifs(d, d.getFileName().toString(), list);
                        } catch (IOException ignored) {}
                    });
                }
            }
        } catch (IOException ignored) {}
        return ResponseEntity.ok(list);
    }

    private void listGifs(Path dir, String category, List<GifInfo> out) throws IOException {
        try (var stream = Files.list(dir)) {
            stream.filter(Files::isRegularFile).forEach(f -> {
                String name = f.getFileName().toString();
                String ext = getExtension(name).toLowerCase(Locale.ROOT);
                if (ALLOWED_EXTENSIONS.contains(ext)) {
                    out.add(new GifInfo("/api/gifs/file/" + category + "/" + name, category, name));
                }
            });
        }
    }

    private static String getExtension(String name) {
        int i = name.lastIndexOf('.');
        return i >= 0 ? name.substring(i + 1) : "";
    }

    private static boolean isAllowedContentType(String ct) {
        if (ct == null) return false;
        return ALLOWED_CONTENT_TYPES.stream().anyMatch(ct::startsWith);
    }

    private static String sanitize(String s) {
        return s == null ? "" : s.replaceAll("[^a-zA-Z0-9_-]", "");
    }

    private static String sanitizeFilename(String s) {
        return s == null ? "" : s.replaceAll("[^a-zA-Z0-9._-]", "");
    }

    public record GifResponse(String url, String category, String originalName, String contentType) {}
    public record GifInfo(String url, String category, String filename) {}
    public record CategoryInfo(String name, long count) {}
}
