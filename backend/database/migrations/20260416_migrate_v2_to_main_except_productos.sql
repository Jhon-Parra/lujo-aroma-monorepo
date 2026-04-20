-- Migra datos desde u571724224_lujoyaroma_v2 hacia u571724224_lujoyaroma
-- Excluye completamente la tabla `productos`.
-- Importante: este script vacia (TRUNCATE) en destino cada tabla incluida antes de copiar.

SET @src_db = 'u571724224_lujoyaroma_v2';
SET @dst_db = 'u571724224_lujoyaroma';

SET FOREIGN_KEY_CHECKS = 0;

DROP TEMPORARY TABLE IF EXISTS tmp_migration_tables;
CREATE TEMPORARY TABLE tmp_migration_tables AS
SELECT s.table_name
FROM information_schema.tables s
JOIN information_schema.tables d
  ON d.table_schema = @dst_db
 AND d.table_name = s.table_name
WHERE s.table_schema = @src_db
  AND s.table_type = 'BASE TABLE'
  AND s.table_name <> 'productos';

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_except_productos $$
CREATE PROCEDURE migrate_except_productos()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE tbl VARCHAR(255);
  DECLARE cur CURSOR FOR
    SELECT table_name FROM tmp_migration_tables ORDER BY table_name;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;

  migration_loop: LOOP
    FETCH cur INTO tbl;
    IF done = 1 THEN
      LEAVE migration_loop;
    END IF;

    SET @truncate_sql = CONCAT('TRUNCATE TABLE `', @dst_db, '`.`', tbl, '`');
    PREPARE stmt_truncate FROM @truncate_sql;
    EXECUTE stmt_truncate;
    DEALLOCATE PREPARE stmt_truncate;

    SET @insert_sql = CONCAT(
      'INSERT INTO `', @dst_db, '`.`', tbl, '` ',
      'SELECT * FROM `', @src_db, '`.`', tbl, '`'
    );
    PREPARE stmt_insert FROM @insert_sql;
    EXECUTE stmt_insert;
    DEALLOCATE PREPARE stmt_insert;
  END LOOP;

  CLOSE cur;
END $$

CALL migrate_except_productos() $$
DROP PROCEDURE migrate_except_productos $$

DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;
