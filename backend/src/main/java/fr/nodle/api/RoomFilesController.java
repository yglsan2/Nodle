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
import java.util.stream.Stream;

/**
 * Fichiers partagés par salle : documents, schémas, diagrammes, PDF, texte.
 * Permet aux élèves d'échanger efficacement des données de travail.
 */
@RestController
@RequestMapping("/api/rooms/{roomId}/files")
public class RoomFilesController {

    @Value("${nodle.room-files.path:./data/room-files}")
    private String baseStoragePath;

    private Path basePath;

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt", "md",
            "doc", "docx", "xls", "xlsx", "odt", "ods", "drawio", "json", "csv"
    );
    private static final long MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 Mo

    @PostConstruct
    public void init() throws IOException {
        basePath = Path.of(baseStoragePath).toAbsolutePath();
        Files.createDirectories(basePath);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SharedFileInfo> upload(
            @PathVariable String roomId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "uploaderName", defaultValue = "") String uploaderName
    ) {
        if (file.isEmpty()) return ResponseEntity.badRequest().build();
        if (file.getSize() > MAX_FILE_SIZE) return ResponseEntity.badRequest().build();

        String originalName = file.getOriginalFilename();
        String ext = originalName != null ? getExtension(originalName).toLowerCase(Locale.ROOT) : "";
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            return ResponseEntity.badRequest().build();
        }

        String safeRoom = sanitize(roomId);
        String fileId = UUID.randomUUID().toString() + "." + ext;
        Path dir = basePath.resolve(safeRoom);
        try {
            Files.createDirectories(dir);
            Path target = dir.resolve(sanitizeFilename(fileId));
            file.transferTo(target.toFile());
            String url = "/api/rooms/" + roomId + "/files/download/" + fileId;
            return ResponseEntity.ok(new SharedFileInfo(
                    fileId,
                    originalName,
                    url,
                    file.getContentType(),
                    file.getSize(),
                    uploaderName,
                    System.currentTimeMillis()
            ));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/download/{fileId}")
    public ResponseEntity<org.springframework.core.io.Resource> download(
            @PathVariable String roomId,
            @PathVariable String fileId
    ) {
        Path dir = basePath.resolve(sanitize(roomId));
        Path file = dir.resolve(sanitizeFilename(fileId));
        if (!Files.isRegularFile(file)) return ResponseEntity.notFound().build();
        try {
            var resource = new org.springframework.core.io.InputStreamResource(Files.newInputStream(file));
            String contentType = Files.probeContentType(file);
            String name = file.getFileName().toString();
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType != null ? contentType : "application/octet-stream"))
                    .header("Content-Disposition", "inline; filename=\"" + name + "\"")
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/list")
    public ResponseEntity<List<SharedFileInfo>> list(@PathVariable String roomId) {
        Path dir = basePath.resolve(sanitize(roomId));
        List<SharedFileInfo> result = new ArrayList<>();
        if (!Files.isDirectory(dir)) return ResponseEntity.ok(result);
        try (Stream<Path> stream = Files.list(dir)) {
            stream.filter(Files::isRegularFile).forEach(f -> {
                String id = f.getFileName().toString();
                try {
                    long size = Files.size(f);
                    String contentType = Files.probeContentType(f);
                    result.add(new SharedFileInfo(
                            id, id, "/api/rooms/" + roomId + "/files/download/" + id,
                            contentType != null ? contentType : "application/octet-stream",
                            size, "", f.toFile().lastModified()
                    ));
                } catch (IOException ignored) {}
            });
        } catch (IOException ignored) {}
        result.sort(Comparator.comparingLong(SharedFileInfo::uploadedAt).reversed());
        return ResponseEntity.ok(result);
    }

    private static String getExtension(String name) {
        int i = name.lastIndexOf('.');
        return i >= 0 ? name.substring(i + 1) : "";
    }

    private static String sanitize(String s) {
        return s == null ? "" : s.replaceAll("[^a-zA-Z0-9_-]", "");
    }

    private static String sanitizeFilename(String s) {
        return s == null ? "" : s.replaceAll("[^a-zA-Z0-9._-]", "");
    }

    public record SharedFileInfo(String id, String name, String url, String contentType, long size, String uploaderName, long uploadedAt) {}
}
