CREATE TABLE user_interest_tags (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,

    CONSTRAINT fk_user_interest_tags_user
        FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE,

    CONSTRAINT fk_user_interest_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags(id)
            ON DELETE CASCADE,

    CONSTRAINT uk_user_interest_tag UNIQUE (user_id, tag_id)
);

CREATE INDEX idx_user_interest_tags_user_id
    ON user_interest_tags(user_id);

CREATE INDEX idx_user_interest_tags_tag_id
    ON user_interest_tags(tag_id);

-- The existing unique key starts with lecture_id. This index supports the
-- recommendation query, which begins with a selected tag.
CREATE INDEX idx_lecture_tags_tag_id
    ON lecture_tags(tag_id);
